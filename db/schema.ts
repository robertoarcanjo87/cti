import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const usuarios = sqliteTable("usuarios", {
  id: integer("id").primaryKey({ autoIncrement: true }), externalId: text("external_id").notNull(), email: text("email").notNull(),
  nome: text("nome").notNull(), papel: text("papel", { enum: ["medico_admin", "recepcao"] }).notNull(),
  crm: text("crm"), crmUf: text("crm_uf"),
  ativo: integer("ativo", { mode: "boolean" }).notNull().default(true), criadoEm: text("criado_em").notNull(),
}, (t) => [uniqueIndex("idx_usuarios_external_id").on(t.externalId), uniqueIndex("idx_usuarios_email").on(t.email)]);

export const pacientes = sqliteTable("pacientes", {
  id: integer("id").primaryKey({ autoIncrement: true }), nome: text("nome").notNull(), nascimento: text("nascimento").notNull(), cpf: text("cpf"),
  telefone: text("telefone").notNull(), endereco: text("endereco").notNull().default(""), contatoEmergencia: text("contato_emergencia").notNull().default(""),
  observacoesAdmin: text("observacoes_admin").notNull().default(""), arquivado: integer("arquivado", { mode: "boolean" }).notNull().default(false),
  criadoEm: text("criado_em").notNull(), atualizadoEm: text("atualizado_em").notNull(),
}, (t) => [uniqueIndex("idx_pacientes_cpf").on(t.cpf), index("idx_pacientes_nome").on(t.nome), index("idx_pacientes_telefone").on(t.telefone)]);

export const prontuarios = sqliteTable("prontuarios", {
  id: integer("id").primaryKey({ autoIncrement: true }), pacienteId: integer("paciente_id").notNull().references(() => pacientes.id),
  anamnese: text("anamnese").notNull().default(""), alergias: text("alergias").notNull().default(""), condicoes: text("condicoes").notNull().default(""),
  medicamentos: text("medicamentos").notNull().default(""), atualizadoPor: integer("atualizado_por").notNull().references(() => usuarios.id), atualizadoEm: text("atualizado_em").notNull(),
}, (t) => [uniqueIndex("idx_prontuarios_paciente").on(t.pacienteId)]);

export const evolucoes = sqliteTable("evolucoes_clinicas", {
  id: integer("id").primaryKey({ autoIncrement: true }), pacienteId: integer("paciente_id").notNull().references(() => pacientes.id),
  autorId: integer("autor_id").notNull().references(() => usuarios.id), texto: text("texto").notNull(), tipo: text("tipo", { enum: ["evolucao", "adendo"] }).notNull().default("evolucao"),
  evolucaoOriginalId: integer("evolucao_original_id"), criadoEm: text("criado_em").notNull(),
}, (t) => [index("idx_evolucoes_paciente_data").on(t.pacienteId, t.criadoEm)]);

export const sintomas = sqliteTable("sintomas_catalogo", {
  id: integer("id").primaryKey({ autoIncrement: true }), nome: text("nome").notNull(), ativo: integer("ativo", { mode: "boolean" }).notNull().default(true),
}, (t) => [uniqueIndex("idx_sintomas_nome").on(t.nome)]);

export const avaliacoesSintomas = sqliteTable("avaliacoes_sintomas", {
  id: integer("id").primaryKey({ autoIncrement: true }), pacienteId: integer("paciente_id").notNull().references(() => pacientes.id),
  sintomaId: integer("sintoma_id").notNull().references(() => sintomas.id), intensidade: integer("intensidade").notNull(), observacao: text("observacao").notNull().default(""),
  autorId: integer("autor_id").notNull().references(() => usuarios.id), avaliadoEm: text("avaliado_em").notNull(),
}, (t) => [index("idx_avaliacoes_paciente_data").on(t.pacienteId, t.avaliadoEm)]);

export const produtos = sqliteTable("produtos_injetaveis", {
  id: integer("id").primaryKey({ autoIncrement: true }), nome: text("nome").notNull(), principioAtivo: text("principio_ativo").notNull(),
  apresentacao: text("apresentacao").notNull(), unidade: text("unidade").notNull().default("ampola"), estoqueMinimo: real("estoque_minimo").notNull().default(0),
  ativo: integer("ativo", { mode: "boolean" }).notNull().default(true),
}, (t) => [uniqueIndex("idx_produtos_nome").on(t.nome)]);

export const lotes = sqliteTable("lotes", {
  id: integer("id").primaryKey({ autoIncrement: true }), produtoId: integer("produto_id").notNull().references(() => produtos.id), numero: text("numero").notNull(),
  validade: text("validade").notNull(), recebidoEm: text("recebido_em").notNull(), saldo: real("saldo").notNull().default(0),
}, (t) => [uniqueIndex("idx_lotes_produto_numero").on(t.produtoId, t.numero), index("idx_lotes_validade").on(t.validade)]);

export const movimentacoes = sqliteTable("movimentacoes_estoque", {
  id: integer("id").primaryKey({ autoIncrement: true }), produtoId: integer("produto_id").notNull().references(() => produtos.id), loteId: integer("lote_id").notNull().references(() => lotes.id),
  tipo: text("tipo", { enum: ["entrada", "saida_aplicacao", "ajuste", "estorno"] }).notNull(), quantidade: real("quantidade").notNull(), motivo: text("motivo").notNull().default(""),
  aplicacaoId: integer("aplicacao_id"), usuarioId: integer("usuario_id").notNull().references(() => usuarios.id), criadoEm: text("criado_em").notNull(),
}, (t) => [index("idx_movimentacoes_lote_data").on(t.loteId, t.criadoEm)]);

export const prescricoes = sqliteTable("prescricoes", {
  id: integer("id").primaryKey({ autoIncrement: true }), pacienteId: integer("paciente_id").notNull().references(() => pacientes.id), medicoId: integer("medico_id").notNull().references(() => usuarios.id),
  estado: text("estado", { enum: ["rascunho", "finalizada", "parcialmente_aplicada", "aplicada", "cancelada"] }).notNull().default("rascunho"),
  observacoes: text("observacoes").notNull().default(""), criadoEm: text("criado_em").notNull(), finalizadoEm: text("finalizado_em"), canceladoEm: text("cancelado_em"),
}, (t) => [index("idx_prescricoes_paciente_estado").on(t.pacienteId, t.estado)]);

export const itensPrescricao = sqliteTable("itens_prescricao", {
  id: integer("id").primaryKey({ autoIncrement: true }), prescricaoId: integer("prescricao_id").notNull().references(() => prescricoes.id), produtoId: integer("produto_id").notNull().references(() => produtos.id),
  concentracao: text("concentracao").notNull(), dose: text("dose").notNull(), via: text("via").notNull(), quantidade: real("quantidade").notNull(), instrucoes: text("instrucoes").notNull().default(""), recorrenciaDias: integer("recorrencia_dias"),
}, (t) => [index("idx_itens_prescricao").on(t.prescricaoId)]);

export const aplicacoes = sqliteTable("aplicacoes", {
  id: integer("id").primaryKey({ autoIncrement: true }), prescricaoId: integer("prescricao_id").notNull().references(() => prescricoes.id), pacienteId: integer("paciente_id").notNull().references(() => pacientes.id),
  profissionalId: integer("profissional_id").notNull().references(() => usuarios.id), localAplicacao: text("local_aplicacao").notNull().default(""), observacoes: text("observacoes").notNull().default(""),
  reacao: text("reacao").notNull().default(""), aplicadoEm: text("aplicado_em").notNull(), estornadaEm: text("estornada_em"),
}, (t) => [index("idx_aplicacoes_paciente_data").on(t.pacienteId, t.aplicadoEm)]);

export const itensAplicacao = sqliteTable("itens_aplicacao", {
  id: integer("id").primaryKey({ autoIncrement: true }), aplicacaoId: integer("aplicacao_id").notNull().references(() => aplicacoes.id), itemPrescricaoId: integer("item_prescricao_id").notNull().references(() => itensPrescricao.id),
  loteId: integer("lote_id").notNull().references(() => lotes.id), quantidade: real("quantidade").notNull(),
}, (t) => [index("idx_itens_aplicacao").on(t.aplicacaoId)]);

export const lembretes = sqliteTable("lembretes_recorrencia", {
  id: integer("id").primaryKey({ autoIncrement: true }), pacienteId: integer("paciente_id").notNull().references(() => pacientes.id), aplicacaoId: integer("aplicacao_id").references(() => aplicacoes.id),
  produtoId: integer("produto_id").references(() => produtos.id), dataPrevista: text("data_prevista").notNull(), estado: text("estado", { enum: ["proximo", "vencido", "contatado", "adiado", "concluido", "cancelado"] }).notNull().default("proximo"),
  notaAdministrativa: text("nota_administrativa").notNull().default(""), atualizadoPor: integer("atualizado_por").references(() => usuarios.id), atualizadoEm: text("atualizado_em").notNull(),
}, (t) => [index("idx_lembretes_data_estado").on(t.dataPrevista, t.estado)]);

export const auditoria = sqliteTable("eventos_auditoria", {
  id: integer("id").primaryKey({ autoIncrement: true }), usuarioId: integer("usuario_id").references(() => usuarios.id), acao: text("acao").notNull(), entidade: text("entidade").notNull(),
  entidadeId: text("entidade_id").notNull().default(""), detalhes: text("detalhes").notNull().default(""), criadoEm: text("criado_em").notNull(),
}, (t) => [index("idx_auditoria_data").on(t.criadoEm), index("idx_auditoria_entidade").on(t.entidade, t.entidadeId)]);
