import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import {
  aplicacoes, auditoria, avaliacoesSintomas, evolucoes, itensAplicacao, itensPrescricao,
  lembretes, lotes, movimentacoes, pacientes, prescricoes, produtos, prontuarios,
  sintomas, usuarios,
} from "@/db/schema";

export const dynamic = "force-dynamic";

type Papel = "medico_admin" | "recepcao";

function now() { return new Date().toISOString(); }
function digits(value: unknown) { return String(value ?? "").replace(/\D/g, ""); }
function text(value: unknown, max = 5000) { return String(value ?? "").trim().slice(0, max); }
function number(value: unknown) { return Number(value); }

async function currentUser(request: Request) {
  const email = request.headers.get("oai-authenticated-user-email");
  if (!email) throw new Response("Autenticação necessária", { status: 401 });
  const externalId = request.headers.get("oai-authenticated-user-id") || `email:${email}`;
  const encodedName = request.headers.get("oai-authenticated-user-full-name");
  const displayName = encodedName ? decodeURIComponent(encodedName) : email.split("@")[0];
  const db = getDb();
  let [user] = await db.select().from(usuarios).where(eq(usuarios.externalId, externalId)).limit(1);
  if (!user) [user] = await db.select().from(usuarios).where(eq(usuarios.email, email)).limit(1);
  if (!user) {
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(usuarios);
    [user] = await db.insert(usuarios).values({ externalId, email, nome: displayName, papel: count === 0 ? "medico_admin" : "recepcao", criadoEm: now() }).returning();
  }
  if (!user.ativo) throw new Response("Usuário inativo", { status: 403 });
  return user;
}

function requireDoctor(papel: Papel) {
  if (papel !== "medico_admin") throw new Response("Acesso clínico restrito ao médico", { status: 403 });
}

async function seedCatalogs() {
  const db = getDb();
  const [{ count: productCount }] = await db.select({ count: sql<number>`count(*)` }).from(produtos);
  if (productCount === 0) await db.insert(produtos).values([
    { nome: "Vitamina B12", principioAtivo: "Cianocobalamina", apresentacao: "2.500 mcg / 1 mL", unidade: "ampola", estoqueMinimo: 10 },
    { nome: "Vitamina D3", principioAtivo: "Colecalciferol", apresentacao: "600.000 UI / 1 mL", unidade: "ampola", estoqueMinimo: 6 },
  ]);
  const [{ count: symptomCount }] = await db.select({ count: sql<number>`count(*)` }).from(sintomas);
  if (symptomCount === 0) await db.insert(sintomas).values(["Fadiga", "Dor muscular", "Fraqueza", "Tontura", "Alteração do sono", "Baixa disposição"].map((nome) => ({ nome })));
}

async function audit(usuarioId: number, acao: string, entidade: string, entidadeId = "", detalhes = "") {
  await getDb().insert(auditoria).values({ usuarioId, acao, entidade, entidadeId, detalhes, criadoEm: now() });
}

async function dashboardPayload(user: Awaited<ReturnType<typeof currentUser>>) {
  await seedCatalogs();
  const db = getDb();
  const patientRows = await db.select().from(pacientes).where(eq(pacientes.arquivado, false)).orderBy(asc(pacientes.nome));
  const productRows = await db.select().from(produtos).where(eq(produtos.ativo, true)).orderBy(asc(produtos.nome));
  const lotRows = await db.select().from(lotes).orderBy(asc(lotes.validade));
  const reminderRows = await db.select({
    id: lembretes.id, pacienteId: lembretes.pacienteId, pacienteNome: pacientes.nome, telefone: pacientes.telefone,
    produtoId: lembretes.produtoId, produtoNome: produtos.nome, dataPrevista: lembretes.dataPrevista,
    estado: lembretes.estado, notaAdministrativa: lembretes.notaAdministrativa,
  }).from(lembretes).innerJoin(pacientes, eq(lembretes.pacienteId, pacientes.id)).leftJoin(produtos, eq(lembretes.produtoId, produtos.id)).orderBy(asc(lembretes.dataPrevista));
  const prescriptionRows = user.papel === "medico_admin" ? await db.select({
    id: prescricoes.id, pacienteId: prescricoes.pacienteId, pacienteNome: pacientes.nome, medicoNome: usuarios.nome,
    estado: prescricoes.estado, observacoes: prescricoes.observacoes, criadoEm: prescricoes.criadoEm, finalizadoEm: prescricoes.finalizadoEm,
    itemId: itensPrescricao.id, produtoId: produtos.id, produtoNome: produtos.nome, apresentacao: produtos.apresentacao,
    concentracao: itensPrescricao.concentracao, dose: itensPrescricao.dose, via: itensPrescricao.via,
    quantidade: itensPrescricao.quantidade, instrucoes: itensPrescricao.instrucoes, recorrenciaDias: itensPrescricao.recorrenciaDias,
  }).from(prescricoes).innerJoin(pacientes, eq(prescricoes.pacienteId, pacientes.id)).innerJoin(usuarios, eq(prescricoes.medicoId, usuarios.id))
    .innerJoin(itensPrescricao, eq(itensPrescricao.prescricaoId, prescricoes.id)).innerJoin(produtos, eq(itensPrescricao.produtoId, produtos.id)).orderBy(desc(prescricoes.criadoEm)) : [];
  const applicationRows = user.papel === "medico_admin" ? await db.select({
    id: aplicacoes.id, prescricaoId: aplicacoes.prescricaoId, pacienteId: aplicacoes.pacienteId, pacienteNome: pacientes.nome,
    produtoNome: produtos.nome, loteNumero: lotes.numero, quantidade: itensAplicacao.quantidade, localAplicacao: aplicacoes.localAplicacao,
    observacoes: aplicacoes.observacoes, reacao: aplicacoes.reacao, aplicadoEm: aplicacoes.aplicadoEm, estornadaEm: aplicacoes.estornadaEm,
  }).from(aplicacoes).innerJoin(pacientes, eq(aplicacoes.pacienteId, pacientes.id)).innerJoin(itensAplicacao, eq(itensAplicacao.aplicacaoId, aplicacoes.id))
    .innerJoin(itensPrescricao, eq(itensAplicacao.itemPrescricaoId, itensPrescricao.id)).innerJoin(produtos, eq(itensPrescricao.produtoId, produtos.id))
    .innerJoin(lotes, eq(itensAplicacao.loteId, lotes.id)).orderBy(desc(aplicacoes.aplicadoEm)) : [];
  const symptomRows = user.papel === "medico_admin" ? await db.select().from(sintomas).where(eq(sintomas.ativo, true)).orderBy(asc(sintomas.nome)) : [];
  const assessmentRows = user.papel === "medico_admin" ? await db.select({
    id: avaliacoesSintomas.id, pacienteId: avaliacoesSintomas.pacienteId, sintomaId: avaliacoesSintomas.sintomaId,
    sintomaNome: sintomas.nome, intensidade: avaliacoesSintomas.intensidade, observacao: avaliacoesSintomas.observacao, avaliadoEm: avaliacoesSintomas.avaliadoEm,
  }).from(avaliacoesSintomas).innerJoin(sintomas, eq(avaliacoesSintomas.sintomaId, sintomas.id)).orderBy(desc(avaliacoesSintomas.avaliadoEm)) : [];
  const chartRows = user.papel === "medico_admin" ? await db.select().from(prontuarios) : [];
  const evolutionRows = user.papel === "medico_admin" ? await db.select({
    id: evolucoes.id, pacienteId: evolucoes.pacienteId, autorNome: usuarios.nome, texto: evolucoes.texto, tipo: evolucoes.tipo,
    evolucaoOriginalId: evolucoes.evolucaoOriginalId, criadoEm: evolucoes.criadoEm,
  }).from(evolucoes).innerJoin(usuarios, eq(evolucoes.autorId, usuarios.id)).orderBy(desc(evolucoes.criadoEm)) : [];
  const auditRows = user.papel === "medico_admin" ? await db.select({
    id: auditoria.id, usuarioNome: usuarios.nome, acao: auditoria.acao, entidade: auditoria.entidade,
    entidadeId: auditoria.entidadeId, detalhes: auditoria.detalhes, criadoEm: auditoria.criadoEm,
  }).from(auditoria).leftJoin(usuarios, eq(auditoria.usuarioId, usuarios.id)).orderBy(desc(auditoria.criadoEm)).limit(80) : [];
  const userRows = user.papel === "medico_admin" ? await db.select({ id: usuarios.id, nome: usuarios.nome, email: usuarios.email, papel: usuarios.papel, ativo: usuarios.ativo }).from(usuarios).orderBy(asc(usuarios.nome)) : [];
  return { user: { id: user.id, nome: user.nome, email: user.email, papel: user.papel }, patients: patientRows, products: productRows, lots: lotRows,
    reminders: reminderRows, prescriptions: prescriptionRows, applications: applicationRows, symptoms: symptomRows, assessments: assessmentRows,
    charts: chartRows, evolutions: evolutionRows, audit: auditRows, users: userRows, settings: { expiryAlertDays: 60, timezone: "America/Fortaleza" } };
}

export async function GET(request: Request) {
  try {
    const user = await currentUser(request);
    const payload = await dashboardPayload(user);
    await audit(user.id, "visualizou", "painel");
    return Response.json(payload);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return Response.json({ error: "Não foi possível carregar os dados da clínica." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await currentUser(request);
    const body = await request.json() as Record<string, unknown>;
    const action = text(body.action, 80);
    const db = getDb();
    const createdAt = now();

    if (action === "create_patient") {
      const nome = text(body.nome, 160), nascimento = text(body.nascimento, 10), telefone = text(body.telefone, 30), cpf = digits(body.cpf) || null;
      if (!nome || !nascimento || !telefone) return Response.json({ error: "Informe nome, nascimento e telefone." }, { status: 400 });
      if (cpf && cpf.length !== 11) return Response.json({ error: "O CPF deve ter 11 dígitos." }, { status: 400 });
      const [patient] = await db.insert(pacientes).values({ nome, nascimento, telefone, cpf, endereco: text(body.endereco, 300), contatoEmergencia: text(body.contatoEmergencia, 200), observacoesAdmin: text(body.observacoesAdmin), criadoEm: createdAt, atualizadoEm: createdAt }).returning();
      await audit(user.id, "criou", "paciente", String(patient.id));
      return Response.json({ ok: true, patient }, { status: 201 });
    }

    if (action === "save_chart") {
      requireDoctor(user.papel as Papel);
      const pacienteId = number(body.pacienteId);
      const existing = await db.select().from(prontuarios).where(eq(prontuarios.pacienteId, pacienteId)).limit(1);
      const data = { anamnese: text(body.anamnese), alergias: text(body.alergias), condicoes: text(body.condicoes), medicamentos: text(body.medicamentos), atualizadoPor: user.id, atualizadoEm: createdAt };
      if (existing.length) await db.update(prontuarios).set(data).where(eq(prontuarios.pacienteId, pacienteId)); else await db.insert(prontuarios).values({ pacienteId, ...data });
      await audit(user.id, "atualizou", "prontuario", String(pacienteId));
      return Response.json({ ok: true });
    }

    if (action === "add_evolution") {
      requireDoctor(user.papel as Papel);
      const pacienteId = number(body.pacienteId), conteudo = text(body.texto);
      if (!conteudo) return Response.json({ error: "Escreva a evolução clínica." }, { status: 400 });
      const [row] = await db.insert(evolucoes).values({ pacienteId, autorId: user.id, texto: conteudo, tipo: body.evolucaoOriginalId ? "adendo" : "evolucao", evolucaoOriginalId: body.evolucaoOriginalId ? number(body.evolucaoOriginalId) : null, criadoEm: createdAt }).returning();
      await audit(user.id, "registrou", row.tipo, String(row.id), `paciente:${pacienteId}`);
      return Response.json({ ok: true });
    }

    if (action === "add_symptom_assessment") {
      requireDoctor(user.papel as Papel);
      const pacienteId = number(body.pacienteId), values = Array.isArray(body.values) ? body.values as Array<Record<string, unknown>> : [];
      const valid = values.filter((v) => Number.isInteger(number(v.sintomaId)) && number(v.intensidade) >= 0 && number(v.intensidade) <= 10);
      if (!valid.length) return Response.json({ error: "Avalie pelo menos um sintoma." }, { status: 400 });
      await db.insert(avaliacoesSintomas).values(valid.map((v) => ({ pacienteId, sintomaId: number(v.sintomaId), intensidade: number(v.intensidade), observacao: text(v.observacao, 500), autorId: user.id, avaliadoEm: createdAt })));
      await audit(user.id, "registrou", "avaliacao_sintomas", String(pacienteId), `${valid.length} sintomas`);
      return Response.json({ ok: true });
    }

    if (action === "receive_stock") {
      const produtoId = number(body.produtoId), numero = text(body.numero, 80), validade = text(body.validade, 10), quantidade = number(body.quantidade);
      if (!produtoId || !numero || !validade || !(quantidade > 0)) return Response.json({ error: "Preencha produto, lote, validade e quantidade." }, { status: 400 });
      let [lot] = await db.select().from(lotes).where(and(eq(lotes.produtoId, produtoId), eq(lotes.numero, numero))).limit(1);
      if (lot) { await db.update(lotes).set({ saldo: lot.saldo + quantidade, validade }).where(eq(lotes.id, lot.id)); }
      else [lot] = await db.insert(lotes).values({ produtoId, numero, validade, recebidoEm: createdAt.slice(0, 10), saldo: quantidade }).returning();
      await db.insert(movimentacoes).values({ produtoId, loteId: lot.id, tipo: "entrada", quantidade, motivo: "Entrada de estoque", usuarioId: user.id, criadoEm: createdAt });
      await audit(user.id, "entrada", "estoque", String(lot.id), `quantidade:${quantidade}`);
      return Response.json({ ok: true });
    }

    if (action === "create_prescription") {
      requireDoctor(user.papel as Papel);
      const pacienteId = number(body.pacienteId), produtoId = number(body.produtoId), quantidade = number(body.quantidade);
      if (!pacienteId || !produtoId || !(quantidade > 0) || !text(body.dose) || !text(body.via)) return Response.json({ error: "Preencha paciente, produto, dose, via e quantidade." }, { status: 400 });
      const [product] = await db.select().from(produtos).where(eq(produtos.id, produtoId)).limit(1);
      const [rx] = await db.insert(prescricoes).values({ pacienteId, medicoId: user.id, estado: "finalizada", observacoes: text(body.observacoes), criadoEm: createdAt, finalizadoEm: createdAt }).returning();
      await db.insert(itensPrescricao).values({ prescricaoId: rx.id, produtoId, concentracao: product?.apresentacao ?? text(body.concentracao), dose: text(body.dose, 100), via: text(body.via, 30), quantidade, instrucoes: text(body.instrucoes), recorrenciaDias: number(body.recorrenciaDias) > 0 ? number(body.recorrenciaDias) : null });
      await audit(user.id, "finalizou", "prescricao", String(rx.id));
      return Response.json({ ok: true, prescriptionId: rx.id }, { status: 201 });
    }

    if (action === "apply_prescription") {
      requireDoctor(user.papel as Papel);
      const prescricaoId = number(body.prescricaoId), loteId = number(body.loteId);
      const [rx] = await db.select().from(prescricoes).where(eq(prescricoes.id, prescricaoId)).limit(1);
      const [item] = await db.select().from(itensPrescricao).where(eq(itensPrescricao.prescricaoId, prescricaoId)).limit(1);
      const [lot] = await db.select().from(lotes).where(eq(lotes.id, loteId)).limit(1);
      if (!rx || !item || !lot || !["finalizada", "parcialmente_aplicada"].includes(rx.estado)) return Response.json({ error: "Prescrição ou lote inválido." }, { status: 400 });
      if (lot.produtoId !== item.produtoId || lot.saldo < item.quantidade) return Response.json({ error: "O lote não possui saldo suficiente para esta aplicação." }, { status: 409 });
      if (lot.validade < createdAt.slice(0, 10)) return Response.json({ error: "Não é permitido utilizar lote vencido." }, { status: 409 });
      const [application] = await db.insert(aplicacoes).values({ prescricaoId, pacienteId: rx.pacienteId, profissionalId: user.id, localAplicacao: text(body.localAplicacao, 100), observacoes: text(body.observacoes), reacao: text(body.reacao), aplicadoEm: createdAt }).returning();
      await db.batch([
        db.insert(itensAplicacao).values({ aplicacaoId: application.id, itemPrescricaoId: item.id, loteId, quantidade: item.quantidade }),
        db.update(lotes).set({ saldo: lot.saldo - item.quantidade }).where(eq(lotes.id, loteId)),
        db.insert(movimentacoes).values({ produtoId: item.produtoId, loteId, tipo: "saida_aplicacao", quantidade: -item.quantidade, motivo: `Aplicação da prescrição ${prescricaoId}`, aplicacaoId: application.id, usuarioId: user.id, criadoEm: createdAt }),
        db.update(prescricoes).set({ estado: "aplicada" }).where(eq(prescricoes.id, prescricaoId)),
        db.insert(auditoria).values({ usuarioId: user.id, acao: "confirmou", entidade: "aplicacao", entidadeId: String(application.id), detalhes: `prescricao:${prescricaoId};lote:${loteId}`, criadoEm: createdAt }),
      ]);
      if (item.recorrenciaDias) {
        const next = new Date(createdAt); next.setUTCDate(next.getUTCDate() + item.recorrenciaDias);
        await db.insert(lembretes).values({ pacienteId: rx.pacienteId, aplicacaoId: application.id, produtoId: item.produtoId, dataPrevista: next.toISOString().slice(0, 10), estado: "proximo", atualizadoPor: user.id, atualizadoEm: createdAt });
      }
      return Response.json({ ok: true, applicationId: application.id });
    }

    if (action === "update_reminder") {
      const id = number(body.id), estado = text(body.estado, 20) as "proximo" | "vencido" | "contatado" | "adiado" | "concluido" | "cancelado";
      const allowed = ["proximo", "vencido", "contatado", "adiado", "concluido", "cancelado"];
      if (!allowed.includes(estado)) return Response.json({ error: "Estado inválido." }, { status: 400 });
      const dataPrevista = text(body.dataPrevista, 10);
      await db.update(lembretes).set({ estado, notaAdministrativa: text(body.notaAdministrativa, 1000), ...(dataPrevista ? { dataPrevista } : {}), atualizadoPor: user.id, atualizadoEm: createdAt }).where(eq(lembretes.id, id));
      await audit(user.id, "atualizou", "lembrete", String(id), estado);
      return Response.json({ ok: true });
    }

    if (action === "add_symptom") {
      requireDoctor(user.papel as Papel);
      const nome = text(body.nome, 120);
      if (!nome) return Response.json({ error: "Informe o nome do sintoma." }, { status: 400 });
      const [row] = await db.insert(sintomas).values({ nome }).returning();
      await audit(user.id, "criou", "sintoma", String(row.id));
      return Response.json({ ok: true });
    }

    if (action === "update_product_minimum") {
      requireDoctor(user.papel as Papel);
      const id = number(body.id), estoqueMinimo = number(body.estoqueMinimo);
      if (!id || estoqueMinimo < 0) return Response.json({ error: "Estoque mínimo inválido." }, { status: 400 });
      await db.update(produtos).set({ estoqueMinimo }).where(eq(produtos.id, id));
      await audit(user.id, "atualizou", "produto", String(id), `estoque_minimo:${estoqueMinimo}`);
      return Response.json({ ok: true });
    }

    if (action === "update_user_role") {
      requireDoctor(user.papel as Papel);
      const id = number(body.id), papel = text(body.papel, 30) as Papel;
      if (!id || !["medico_admin", "recepcao"].includes(papel)) return Response.json({ error: "Perfil inválido." }, { status: 400 });
      if (id === user.id && papel !== "medico_admin") return Response.json({ error: "O administrador atual não pode remover o próprio acesso médico." }, { status: 409 });
      await db.update(usuarios).set({ papel }).where(eq(usuarios.id, id));
      await audit(user.id, "alterou_perfil", "usuario", String(id), papel);
      return Response.json({ ok: true });
    }

    if (action === "archive_patient") {
      const id = number(body.id);
      await db.update(pacientes).set({ arquivado: true, atualizadoEm: createdAt }).where(eq(pacientes.id, id));
      await audit(user.id, "arquivou", "paciente", String(id));
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Ação não reconhecida." }, { status: 400 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    const message = error instanceof Error && error.message.includes("UNIQUE") ? "Já existe um registro com esses dados." : "Não foi possível concluir a operação.";
    return Response.json({ error: message }, { status: 500 });
  }
}
