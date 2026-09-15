import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
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
  if (!email) throw Response.json({ error: "Autenticação necessária. Faça login para continuar." }, { status: 401 });
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
  if (!user.ativo) throw Response.json({ error: "Seu usuário está inativo no sistema. Procure o administrador." }, { status: 403 });
  return user;
}

function requireDoctor(papel: Papel) {
  if (papel !== "medico_admin") throw Response.json({ error: "Acesso clínico restrito ao médico administrador." }, { status: 403 });
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
  const patientRows = await db.select().from(pacientes).orderBy(asc(pacientes.nome));
  const productRows = await db.select().from(produtos).orderBy(asc(produtos.nome));
  const lotRows = await db.select().from(lotes).orderBy(asc(lotes.validade));
  const reminderRows = await db.select({
    id: lembretes.id, pacienteId: lembretes.pacienteId, pacienteNome: pacientes.nome, telefone: pacientes.telefone,
    produtoId: lembretes.produtoId, produtoNome: produtos.nome, dataPrevista: lembretes.dataPrevista,
    estado: lembretes.estado, notaAdministrativa: lembretes.notaAdministrativa,
  }).from(lembretes).innerJoin(pacientes, eq(lembretes.pacienteId, pacientes.id)).leftJoin(produtos, eq(lembretes.produtoId, produtos.id)).orderBy(asc(lembretes.dataPrevista));
  const prescriptionRows = user.papel === "medico_admin" ? await db.select({
    id: prescricoes.id, pacienteId: prescricoes.pacienteId, pacienteNome: pacientes.nome, medicoNome: usuarios.nome,
    medicoCrm: usuarios.crm, medicoCrmUf: usuarios.crmUf,
    estado: prescricoes.estado, observacoes: prescricoes.observacoes, criadoEm: prescricoes.criadoEm, finalizadoEm: prescricoes.finalizadoEm, canceladoEm: prescricoes.canceladoEm,
    itemId: itensPrescricao.id, produtoId: produtos.id, produtoNome: produtos.nome, apresentacao: produtos.apresentacao,
    concentracao: itensPrescricao.concentracao, dose: itensPrescricao.dose, via: itensPrescricao.via,
    quantidade: itensPrescricao.quantidade, instrucoes: itensPrescricao.instrucoes, recorrenciaDias: itensPrescricao.recorrenciaDias,
  }).from(prescricoes).innerJoin(pacientes, eq(prescricoes.pacienteId, pacientes.id)).innerJoin(usuarios, eq(prescricoes.medicoId, usuarios.id))
    .innerJoin(itensPrescricao, eq(itensPrescricao.prescricaoId, prescricoes.id)).innerJoin(produtos, eq(itensPrescricao.produtoId, produtos.id)).orderBy(desc(prescricoes.criadoEm)) : [];
  const applicationRows = user.papel === "medico_admin" ? await db.select({
    id: aplicacoes.id, prescricaoId: aplicacoes.prescricaoId, pacienteId: aplicacoes.pacienteId, pacienteNome: pacientes.nome,
    localAplicacao: aplicacoes.localAplicacao, observacoes: aplicacoes.observacoes, reacao: aplicacoes.reacao,
    aplicadoEm: aplicacoes.aplicadoEm, estornadaEm: aplicacoes.estornadaEm,
    itemAplicacaoId: itensAplicacao.id, itemPrescricaoId: itensAplicacao.itemPrescricaoId, produtoId: produtos.id,
    produtoNome: produtos.nome, loteId: lotes.id, loteNumero: lotes.numero, quantidade: itensAplicacao.quantidade,
  }).from(aplicacoes).innerJoin(pacientes, eq(aplicacoes.pacienteId, pacientes.id)).innerJoin(itensAplicacao, eq(itensAplicacao.aplicacaoId, aplicacoes.id))
    .innerJoin(itensPrescricao, eq(itensAplicacao.itemPrescricaoId, itensPrescricao.id)).innerJoin(produtos, eq(itensPrescricao.produtoId, produtos.id))
    .innerJoin(lotes, eq(itensAplicacao.loteId, lotes.id)).orderBy(desc(aplicacoes.aplicadoEm)) : [];
  const stockMovements = await db.select({
    id: movimentacoes.id, produtoId: movimentacoes.produtoId, produtoNome: produtos.nome,
    loteId: movimentacoes.loteId, loteNumero: lotes.numero, tipo: movimentacoes.tipo,
    quantidade: movimentacoes.quantidade, motivo: movimentacoes.motivo, usuarioNome: usuarios.nome, criadoEm: movimentacoes.criadoEm,
  }).from(movimentacoes).innerJoin(produtos, eq(movimentacoes.produtoId, produtos.id)).innerJoin(lotes, eq(movimentacoes.loteId, lotes.id)).innerJoin(usuarios, eq(movimentacoes.usuarioId, usuarios.id)).orderBy(desc(movimentacoes.criadoEm)).limit(100);
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
  }).from(auditoria).leftJoin(usuarios, eq(auditoria.usuarioId, usuarios.id)).orderBy(desc(auditoria.criadoEm)).limit(100) : [];
  const userRows = user.papel === "medico_admin" ? await db.select({ id: usuarios.id, nome: usuarios.nome, email: usuarios.email, papel: usuarios.papel, crm: usuarios.crm, crmUf: usuarios.crmUf, ativo: usuarios.ativo }).from(usuarios).orderBy(asc(usuarios.nome)) : [];
  const prescriptionsPayload = Array.from(prescriptionRows.reduce((groups, row) => {
    let prescription = groups.get(row.id);
    if (!prescription) {
      prescription = { id: row.id, pacienteId: row.pacienteId, pacienteNome: row.pacienteNome, medicoNome: row.medicoNome,
        medicoCrm: row.medicoCrm, medicoCrmUf: row.medicoCrmUf,
        estado: row.estado, observacoes: row.observacoes, criadoEm: row.criadoEm, finalizadoEm: row.finalizadoEm, canceladoEm: row.canceladoEm, items: [] as Array<Record<string, unknown>> };
      groups.set(row.id, prescription);
    }
    prescription.items.push({ id: row.itemId, produtoId: row.produtoId, produtoNome: row.produtoNome, apresentacao: row.apresentacao,
      concentracao: row.concentracao, dose: row.dose, via: row.via, quantidade: row.quantidade, instrucoes: row.instrucoes, recorrenciaDias: row.recorrenciaDias });
    return groups;
  }, new Map<number, Record<string, unknown> & { items: Array<Record<string, unknown>> }>()).values());
  const applicationsPayload = Array.from(applicationRows.reduce((groups, row) => {
    let application = groups.get(row.id);
    if (!application) {
      application = { id: row.id, prescricaoId: row.prescricaoId, pacienteId: row.pacienteId, pacienteNome: row.pacienteNome,
        localAplicacao: row.localAplicacao, observacoes: row.observacoes, reacao: row.reacao, aplicadoEm: row.aplicadoEm,
        estornadaEm: row.estornadaEm, items: [] as Array<Record<string, unknown>> };
      groups.set(row.id, application);
    }
    application.items.push({ id: row.itemAplicacaoId, itemPrescricaoId: row.itemPrescricaoId, produtoId: row.produtoId,
      produtoNome: row.produtoNome, loteId: row.loteId, loteNumero: row.loteNumero, quantidade: row.quantidade });
    return groups;
  }, new Map<number, Record<string, unknown> & { items: Array<Record<string, unknown>> }>()).values());
  return { user: { id: user.id, nome: user.nome, email: user.email, papel: user.papel, crm: user.crm, crmUf: user.crmUf },
    patients: patientRows, products: productRows, lots: lotRows, movements: stockMovements,
    reminders: reminderRows, prescriptions: prescriptionsPayload, applications: applicationsPayload, symptoms: symptomRows, assessments: assessmentRows,
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
  let currentUserId: number | null = null;
  let requestedAction = "desconhecida";
  try {
    const user = await currentUser(request);
    currentUserId = user.id;
    const body = await request.json() as Record<string, unknown>;
    const action = text(body.action, 80);
    requestedAction = action;
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
      if (!pacienteId) return Response.json({ error: "ID do paciente inválido." }, { status: 400 });
      const [patient] = await db.select({ nome: pacientes.nome }).from(pacientes).where(eq(pacientes.id, pacienteId)).limit(1);
      const patientName = patient?.nome ?? `#${pacienteId}`;
      const [existing] = await db.select().from(prontuarios).where(eq(prontuarios.pacienteId, pacienteId)).limit(1);
      const data = {
        anamnese: text(body.anamnese),
        alergias: text(body.alergias),
        condicoes: text(body.condicoes),
        medicamentos: text(body.medicamentos),
        atualizadoPor: user.id,
        atualizadoEm: createdAt,
      };

      if (existing) {
        const changes: string[] = [];
        if (existing.alergias !== data.alergias) {
          changes.push(`Alergias: [${existing.alergias || "nenhuma"} ➔ ${data.alergias || "nenhuma"}]`);
        }
        if (existing.condicoes !== data.condicoes) {
          changes.push(`Condições: [${existing.condicoes || "nenhuma"} ➔ ${data.condicoes || "nenhuma"}]`);
        }
        if (existing.medicamentos !== data.medicamentos) {
          changes.push(`Medicamentos: [${existing.medicamentos || "nenhum"} ➔ ${data.medicamentos || "nenhum"}]`);
        }
        if (existing.anamnese !== data.anamnese) {
          changes.push(`Anamnese revisada (anterior: ${existing.anamnese.slice(0, 100)}...)`);
        }

        const auditDetail = changes.length
          ? `Paciente ${patientName}: ${changes.join(" | ")}`
          : `Paciente ${patientName}: Prontuário revisado sem alterações de conteúdo.`;

        await db.batch([
          db.update(prontuarios).set(data).where(eq(prontuarios.pacienteId, pacienteId)),
          db.insert(auditoria).values({
            usuarioId: user.id,
            acao: "atualizou_prontuario",
            entidade: "prontuario",
            entidadeId: String(pacienteId),
            detalhes: auditDetail,
            criadoEm: createdAt,
          }),
        ]);
      } else {
        await db.batch([
          db.insert(prontuarios).values({ pacienteId, ...data }),
          db.insert(auditoria).values({
            usuarioId: user.id,
            acao: "criou_prontuario",
            entidade: "prontuario",
            entidadeId: String(pacienteId),
            detalhes: `Paciente ${patientName} | Alergias: ${data.alergias || "nenhuma"} | Medicamentos: ${data.medicamentos || "nenhum"}`,
            criadoEm: createdAt,
          }),
        ]);
      }
      return Response.json({ ok: true });
    }

    if (action === "record_consultation") {
      requireDoctor(user.papel as Papel);
      const pacienteId = number(body.pacienteId);
      const conteudo = text(body.texto);
      const rawSymptoms = body.sintomas ?? body.values;
      const values = Array.isArray(rawSymptoms) ? rawSymptoms as Array<Record<string, unknown>> : [];
      const validSymptoms = values.filter((v) => Number.isInteger(number(v.sintomaId)) && number(v.intensidade) >= 0 && number(v.intensidade) <= 10);

      if (!pacienteId) return Response.json({ error: "Paciente inválido." }, { status: 400 });
      if (!conteudo && !validSymptoms.length) return Response.json({ error: "Informe a evolução clínica ou avalie os sintomas." }, { status: 400 });

      let evolutionId: number | null = null;
      if (conteudo) {
        const [ev] = await db.insert(evolucoes).values({
          pacienteId,
          autorId: user.id,
          texto: conteudo,
          tipo: "evolucao",
          criadoEm: createdAt,
        }).returning();
        evolutionId = ev.id;
      }

      if (validSymptoms.length) {
        await db.insert(avaliacoesSintomas).values(
          validSymptoms.map((v) => ({
            pacienteId,
            sintomaId: number(v.sintomaId),
            intensidade: number(v.intensidade),
            observacao: text(v.observacao, 500),
            autorId: user.id,
            avaliadoEm: createdAt,
          }))
        );
      }

      await audit(user.id, "registrou", "consulta_integrada", String(pacienteId), `evolucao:${evolutionId ?? "nao"};sintomas:${validSymptoms.length}`);
      return Response.json({ ok: true, evolutionId });
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
      if (lot) {
        await db.batch([
          db.update(lotes).set({ saldo: sql`${lotes.saldo} + ${quantidade}`, validade }).where(eq(lotes.id, lot.id)),
          db.insert(movimentacoes).values({ produtoId, loteId: lot.id, tipo: "entrada", quantidade, motivo: "Entrada de estoque", usuarioId: user.id, criadoEm: createdAt }),
          db.insert(auditoria).values({ usuarioId: user.id, acao: "entrada", entidade: "estoque", entidadeId: String(lot.id), detalhes: `Lote ${numero}; quantidade:+${quantidade}`, criadoEm: createdAt }),
        ]);
      } else {
        [lot] = await db.insert(lotes).values({ produtoId, numero, validade, recebidoEm: createdAt.slice(0, 10), saldo: quantidade }).returning();
        await db.batch([
          db.insert(movimentacoes).values({ produtoId, loteId: lot.id, tipo: "entrada", quantidade, motivo: "Entrada de estoque", usuarioId: user.id, criadoEm: createdAt }),
          db.insert(auditoria).values({ usuarioId: user.id, acao: "entrada", entidade: "estoque", entidadeId: String(lot.id), detalhes: `Novo lote ${numero}; quantidade:+${quantidade}`, criadoEm: createdAt }),
        ]);
      }
      return Response.json({ ok: true });
    }

    if (action === "create_prescription") {
      requireDoctor(user.papel as Papel);
      const pacienteId = number(body.pacienteId);
      const rawItems = Array.isArray(body.itens) ? body.itens as Array<Record<string, unknown>> : [];
      const items = rawItems.map((item) => ({ produtoId: number(item.produtoId), dose: text(item.dose, 100), via: text(item.via, 30),
        quantidade: number(item.quantidade), instrucoes: text(item.instrucoes), recorrenciaDias: number(item.recorrenciaDias) > 0 ? number(item.recorrenciaDias) : null }));
      if (!pacienteId || !items.length || items.some((item) => !item.produtoId || !(item.quantidade > 0) || !item.dose || !item.via)) return Response.json({ error: "Preencha paciente, dose, via e quantidade de cada injetável." }, { status: 400 });
      if (new Set(items.map((item) => item.produtoId)).size !== items.length) return Response.json({ error: "Cada injetável pode constar apenas uma vez na prescrição." }, { status: 400 });
      const selectedProducts = await db.select().from(produtos).where(inArray(produtos.id, items.map((item) => item.produtoId)));
      if (selectedProducts.length !== items.length || selectedProducts.some((product) => !product.ativo)) return Response.json({ error: "Um dos injetáveis selecionados não está disponível." }, { status: 400 });
      const productById = new Map(selectedProducts.map((product) => [product.id, product]));
      const [rx] = await db.insert(prescricoes).values({ pacienteId, medicoId: user.id, estado: "finalizada", observacoes: text(body.observacoes), criadoEm: createdAt, finalizadoEm: createdAt }).returning();
      try {
        const writes = [
          ...items.map((item) => db.insert(itensPrescricao).values({ prescricaoId: rx.id, produtoId: item.produtoId,
            concentracao: productById.get(item.produtoId)?.apresentacao ?? "", dose: item.dose, via: item.via, quantidade: item.quantidade,
            instrucoes: item.instrucoes, recorrenciaDias: item.recorrenciaDias })),
          db.insert(auditoria).values({ usuarioId: user.id, acao: "finalizou", entidade: "prescricao", entidadeId: String(rx.id), detalhes: `itens:${items.length}`, criadoEm: createdAt }),
        ];
        await db.batch(writes as [typeof writes[number], ...typeof writes[number][]]);
      } catch (err) {
        await db.delete(prescricoes).where(eq(prescricoes.id, rx.id));
        throw err;
      }
      return Response.json({ ok: true, prescriptionId: rx.id }, { status: 201 });
    }

    if (action === "apply_prescription") {
      requireDoctor(user.papel as Papel);
      const prescricaoId = number(body.prescricaoId);
      const selected = (Array.isArray(body.itens) ? body.itens : []).map((item) => item as Record<string, unknown>).map((item) => ({ itemPrescricaoId: number(item.itemPrescricaoId), loteId: number(item.loteId) }));
      const [rx] = await db.select().from(prescricoes).where(eq(prescricoes.id, prescricaoId)).limit(1);
      if (!rx || !["finalizada", "parcialmente_aplicada"].includes(rx.estado) || !selected.length) return Response.json({ error: "Prescrição ou itens de aplicação inválidos." }, { status: 400 });
      if (new Set(selected.map((item) => item.itemPrescricaoId)).size !== selected.length || selected.some((item) => !item.itemPrescricaoId || !item.loteId)) return Response.json({ error: "Selecione um lote para cada injetável que será aplicado." }, { status: 400 });
      const prescriptionItems = await db.select().from(itensPrescricao).where(eq(itensPrescricao.prescricaoId, prescricaoId));
      const appliedRows = await db.select({ itemPrescricaoId: itensAplicacao.itemPrescricaoId }).from(itensAplicacao).innerJoin(aplicacoes, eq(itensAplicacao.aplicacaoId, aplicacoes.id)).where(and(eq(aplicacoes.prescricaoId, prescricaoId), sql`${aplicacoes.estornadaEm} IS NULL`));
      const appliedItemIds = new Set(appliedRows.map((row) => row.itemPrescricaoId));
      const itemById = new Map(prescriptionItems.filter((item) => !appliedItemIds.has(item.id)).map((item) => [item.id, item]));
      const lotsById = new Map((await db.select().from(lotes).where(inArray(lotes.id, selected.map((item) => item.loteId)))).map((lot) => [lot.id, lot]));
      const selectedRows = selected.map((selection) => ({ selection, item: itemById.get(selection.itemPrescricaoId), lot: lotsById.get(selection.loteId) }));
      if (selectedRows.some(({ item, lot }) => !item || !lot || lot.produtoId !== item.produtoId || lot.saldo < item.quantidade || lot.validade < createdAt.slice(0, 10))) return Response.json({ error: "Revise os lotes: há produto divergente, validade vencida ou saldo insuficiente." }, { status: 409 });
      const nextState = (appliedItemIds.size + selectedRows.length) >= prescriptionItems.length ? "aplicada" : "parcialmente_aplicada";
      const recurring = selectedRows.filter(({ item }) => item!.recorrenciaDias);
      const [application] = await db.insert(aplicacoes).values({ prescricaoId, pacienteId: rx.pacienteId, profissionalId: user.id, localAplicacao: text(body.localAplicacao, 100), observacoes: text(body.observacoes), reacao: text(body.reacao), aplicadoEm: createdAt }).returning();
      try {
        const writes = [
          ...selectedRows.flatMap(({ selection, item }) => [
            db.insert(itensAplicacao).values({ aplicacaoId: application.id, itemPrescricaoId: item!.id, loteId: selection.loteId, quantidade: item!.quantidade }),
            db.update(lotes).set({ saldo: sql`${lotes.saldo} - ${item!.quantidade}` }).where(and(eq(lotes.id, selection.loteId), sql`${lotes.saldo} >= ${item!.quantidade}`)),
            db.insert(movimentacoes).values({ produtoId: item!.produtoId, loteId: selection.loteId, tipo: "saida_aplicacao", quantidade: -item!.quantidade, motivo: `Aplicação da prescrição #${prescricaoId}`, aplicacaoId: application.id, usuarioId: user.id, criadoEm: createdAt }),
          ]),
          ...(recurring.length ? [db.insert(lembretes).values(recurring.map(({ item }) => {
            const next = new Date(createdAt); next.setUTCDate(next.getUTCDate() + item!.recorrenciaDias!);
            return { pacienteId: rx.pacienteId, aplicacaoId: application.id, produtoId: item!.produtoId, dataPrevista: next.toISOString().slice(0, 10), estado: "proximo" as const, atualizadoPor: user.id, atualizadoEm: createdAt };
          }))] : []),
          db.update(prescricoes).set({ estado: nextState }).where(eq(prescricoes.id, prescricaoId)),
          db.insert(auditoria).values({ usuarioId: user.id, acao: "confirmou", entidade: "aplicacao", entidadeId: String(application.id), detalhes: `prescricao:${prescricaoId};itens:${selectedRows.length};novo_estado:${nextState}`, criadoEm: createdAt }),
        ];
        await db.batch(writes as [typeof writes[number], ...typeof writes[number][]]);
      } catch (error) {
        await db.delete(itensAplicacao).where(eq(itensAplicacao.aplicacaoId, application.id));
        await db.delete(movimentacoes).where(eq(movimentacoes.aplicacaoId, application.id));
        await db.delete(lembretes).where(eq(lembretes.aplicacaoId, application.id));
        await db.delete(aplicacoes).where(eq(aplicacoes.id, application.id));
        throw error;
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

    if (action === "update_patient") {
      const id = number(body.id);
      const nome = text(body.nome, 160), nascimento = text(body.nascimento, 10), telefone = text(body.telefone, 30), cpf = digits(body.cpf) || null;
      if (!id || !nome || !nascimento || !telefone) return Response.json({ error: "Informe nome, nascimento e telefone." }, { status: 400 });
      if (cpf && cpf.length !== 11) return Response.json({ error: "O CPF deve ter 11 dígitos." }, { status: 400 });
      await db.update(pacientes).set({
        nome, nascimento, telefone, cpf,
        endereco: text(body.endereco, 300),
        contatoEmergencia: text(body.contatoEmergencia, 200),
        observacoesAdmin: text(body.observacoesAdmin),
        atualizadoEm: createdAt,
      }).where(eq(pacientes.id, id));
      await audit(user.id, "atualizou", "paciente", String(id));
      return Response.json({ ok: true });
    }

    if (action === "archive_patient") {
      const id = number(body.id);
      await db.update(pacientes).set({ arquivado: true, atualizadoEm: createdAt }).where(eq(pacientes.id, id));
      await audit(user.id, "arquivou", "paciente", String(id));
      return Response.json({ ok: true });
    }

    if (action === "unarchive_patient") {
      const id = number(body.id);
      await db.update(pacientes).set({ arquivado: false, atualizadoEm: createdAt }).where(eq(pacientes.id, id));
      await audit(user.id, "desarquivou", "paciente", String(id));
      return Response.json({ ok: true });
    }

    if (action === "create_product") {
      requireDoctor(user.papel as Papel);
      const nome = text(body.nome, 120), principioAtivo = text(body.principioAtivo, 120), apresentacao = text(body.apresentacao, 120), unidade = text(body.unidade, 30) || "ampola", estoqueMinimo = Math.max(0, number(body.estoqueMinimo) || 0);
      if (!nome || !principioAtivo || !apresentacao) return Response.json({ error: "Preencha nome, princípio ativo e apresentação." }, { status: 400 });
      const [prod] = await db.insert(produtos).values({ nome, principioAtivo, apresentacao, unidade, estoqueMinimo, ativo: true }).returning();
      await audit(user.id, "criou", "produto", String(prod.id), nome);
      return Response.json({ ok: true, product: prod }, { status: 201 });
    }

    if (action === "toggle_product") {
      requireDoctor(user.papel as Papel);
      const id = number(body.id);
      const ativo = Boolean(body.ativo);
      if (!id) return Response.json({ error: "ID inválido." }, { status: 400 });
      await db.update(produtos).set({ ativo }).where(eq(produtos.id, id));
      await audit(user.id, ativo ? "ativou" : "desativou", "produto", String(id));
      return Response.json({ ok: true });
    }

    if (action === "adjust_stock") {
      requireDoctor(user.papel as Papel);
      const produtoId = number(body.produtoId), loteId = number(body.loteId), quantidade = Math.abs(number(body.quantidade)), motivo = text(body.motivo, 300);
      const tipoAjuste = text(body.tipoAjuste, 30) || "descarte";
      if (!produtoId || !loteId || !(quantidade > 0) || !motivo) return Response.json({ error: "Informe lote, quantidade e motivo do ajuste." }, { status: 400 });
      const [lot] = await db.select().from(lotes).where(and(eq(lotes.id, loteId), eq(lotes.produtoId, produtoId))).limit(1);
      if (!lot || lot.saldo < quantidade) return Response.json({ error: "Lote não encontrado ou saldo insuficiente para baixa." }, { status: 400 });
      
      await db.batch([
        db.update(lotes)
          .set({ saldo: sql`${lotes.saldo} - ${quantidade}` })
          .where(and(eq(lotes.id, loteId), sql`${lotes.saldo} >= ${quantidade}`)),
        db.insert(movimentacoes).values({
          produtoId, loteId, tipo: "ajuste", quantidade: -quantidade, motivo: `[${tipoAjuste.toUpperCase()}] ${motivo}`, usuarioId: user.id, criadoEm: createdAt
        }),
        db.insert(auditoria).values({
          usuarioId: user.id, acao: "ajuste_estoque", entidade: "lote", entidadeId: String(loteId), detalhes: `baixa:${quantidade};tipo:${tipoAjuste};motivo:${motivo}`, criadoEm: createdAt
        }),
      ]);
      return Response.json({ ok: true });
    }

    if (action === "cancel_prescription") {
      requireDoctor(user.papel as Papel);
      const id = number(body.id), motivo = text(body.motivo, 300);
      const [rx] = await db.select().from(prescricoes).where(eq(prescricoes.id, id)).limit(1);
      if (!rx) return Response.json({ error: "Prescrição não encontrada." }, { status: 404 });
      if (rx.estado === "cancelada") return Response.json({ error: "Prescrição já se encontra cancelada." }, { status: 400 });
      if (rx.estado === "aplicada") return Response.json({ error: "Não é possível cancelar uma prescrição já totalmente aplicada." }, { status: 400 });
      await db.update(prescricoes).set({ estado: "cancelada", canceladoEm: createdAt, observacoes: rx.observacoes ? `${rx.observacoes} | Cancelamento: ${motivo}` : `Cancelamento: ${motivo}` }).where(eq(prescricoes.id, id));
      await audit(user.id, "cancelou", "prescricao", String(id), motivo);
      return Response.json({ ok: true });
    }

    if (action === "reverse_application") {
      requireDoctor(user.papel as Papel);
      const aplicacaoId = number(body.aplicacaoId), motivo = text(body.motivo, 300);
      if (!aplicacaoId || !motivo) return Response.json({ error: "Informe a aplicação e o motivo do estorno." }, { status: 400 });
      const [app] = await db.select().from(aplicacoes).where(eq(aplicacoes.id, aplicacaoId)).limit(1);
      if (!app) return Response.json({ error: "Aplicação não encontrada." }, { status: 404 });
      if (app.estornadaEm) return Response.json({ error: "Esta aplicação já foi estornada anteriormente." }, { status: 400 });

      const items = await db.select().from(itensAplicacao).where(eq(itensAplicacao.aplicacaoId, aplicacaoId));
      if (!items.length) return Response.json({ error: "Nenhum item associado a esta aplicação para estornar." }, { status: 400 });

      const usedLotes = await db.select().from(lotes).where(inArray(lotes.id, items.map((i) => i.loteId)));
      const loteById = new Map(usedLotes.map((l) => [l.id, l]));

      const remainingApps = await db.select().from(aplicacoes).where(and(
        eq(aplicacoes.prescricaoId, app.prescricaoId),
        sql`${aplicacoes.id} != ${aplicacaoId}`,
        sql`${aplicacoes.estornadaEm} IS NULL`
      ));
      const nextState = remainingApps.length > 0 ? "parcialmente_aplicada" : "finalizada";

      type BatchOp = Parameters<typeof db.batch>[0][number];
      const writes: BatchOp[] = [];
      for (const item of items) {
        const lot = loteById.get(item.loteId);
        writes.push(
          db.update(lotes)
            .set({ saldo: sql`${lotes.saldo} + ${item.quantidade}` })
            .where(eq(lotes.id, item.loteId))
        );
        writes.push(
          db.insert(movimentacoes).values({
            produtoId: lot?.produtoId ?? 0,
            loteId: item.loteId,
            tipo: "estorno",
            quantidade: item.quantidade,
            motivo: `Estorno da aplicação #${aplicacaoId}: ${motivo}`,
            aplicacaoId,
            usuarioId: user.id,
            criadoEm: createdAt,
          })
        );
      }

      writes.push(
        db.update(aplicacoes)
          .set({ estornadaEm: createdAt, observacoes: app.observacoes ? `${app.observacoes} | Estorno: ${motivo}` : `Estorno: ${motivo}` })
          .where(and(eq(aplicacoes.id, aplicacaoId), sql`${aplicacoes.estornadaEm} IS NULL`))
      );

      writes.push(
        db.update(lembretes)
          .set({ estado: "cancelado", notaAdministrativa: `Estornado: ${motivo}`, atualizadoPor: user.id, atualizadoEm: createdAt })
          .where(and(eq(lembretes.aplicacaoId, aplicacaoId), sql`${lembretes.estado} != 'concluido'`))
      );

      writes.push(
        db.update(prescricoes).set({ estado: nextState }).where(eq(prescricoes.id, app.prescricaoId))
      );

      writes.push(
        db.insert(auditoria).values({
          usuarioId: user.id,
          acao: "estornou",
          entidade: "aplicacao",
          entidadeId: String(aplicacaoId),
          detalhes: `Motivo: ${motivo} | Prescrição #${app.prescricaoId} retornou a ${nextState}`,
          criadoEm: createdAt,
        })
      );

      await db.batch(writes as [typeof writes[number], ...typeof writes[number][]]);
      return Response.json({ ok: true });
    }

    if (action === "update_user_profile") {
      const id = number(body.id) || user.id;
      if (id !== user.id && user.papel !== "medico_admin") return Response.json({ error: "Acesso não autorizado." }, { status: 403 });
      const crm = body.crm !== undefined ? text(body.crm, 30) : undefined;
      const crmUf = body.crmUf !== undefined ? text(body.crmUf, 2).toUpperCase() : undefined;
      const nome = body.nome ? text(body.nome, 120) : undefined;
      const updates: Record<string, unknown> = {};
      if (crm !== undefined) updates.crm = crm;
      if (crmUf !== undefined) updates.crmUf = crmUf;
      if (nome) updates.nome = nome;
      if (Object.keys(updates).length) {
        await db.update(usuarios).set(updates).where(eq(usuarios.id, id));
        await audit(user.id, "atualizou_perfil", "usuario", String(id), `crm:${crm ?? ""}/${crmUf ?? ""}`);
      }
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Ação não reconhecida." }, { status: 400 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Erro na API CTI:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Registrar falhas de sistema na trilha de auditoria para conformidade sanitária
    try {
      const db = getDb();
      await db.insert(auditoria).values({
        usuarioId: currentUserId,
        acao: "falha_sistema",
        entidade: "api",
        entidadeId: requestedAction,
        detalhes: `Erro ao executar ação "${requestedAction}": ${errorMessage.slice(0, 500)}`,
        criadoEm: now(),
      });
    } catch (auditErr) {
      console.error("Falha ao registrar log de auditoria de erro:", auditErr);
    }

    let userMessage = "Não foi possível concluir a operação.";
    let statusCode = 500;
    if (errorMessage.includes("UNIQUE")) {
      statusCode = 409;
      if (errorMessage.toLowerCase().includes("cpf")) {
        userMessage = "Já existe um paciente cadastrado com este CPF.";
      } else if (errorMessage.toLowerCase().includes("email")) {
        userMessage = "Já existe um usuário cadastrado com este e-mail.";
      } else if (errorMessage.toLowerCase().includes("lote")) {
        userMessage = "Já existe um lote com este número para o produto selecionado.";
      } else if (errorMessage.toLowerCase().includes("nome")) {
        userMessage = "Já existe um cadastro com este nome no sistema.";
      } else {
        userMessage = "Já existe um registro com esses dados no sistema.";
      }
    } else if (errorMessage.toLowerCase().includes("saldo") || errorMessage.toLowerCase().includes("insuficiente")) {
      statusCode = 409;
      userMessage = "Saldo de estoque insuficiente para concluir a operação.";
    }

    return Response.json({ error: userMessage, details: process.env.NODE_ENV === "development" ? errorMessage : undefined }, { status: statusCode });
  }
}
