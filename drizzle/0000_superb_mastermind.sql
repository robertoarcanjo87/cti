CREATE TABLE `aplicacoes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`prescricao_id` integer NOT NULL,
	`paciente_id` integer NOT NULL,
	`profissional_id` integer NOT NULL,
	`local_aplicacao` text DEFAULT '' NOT NULL,
	`observacoes` text DEFAULT '' NOT NULL,
	`reacao` text DEFAULT '' NOT NULL,
	`aplicado_em` text NOT NULL,
	`estornada_em` text,
	FOREIGN KEY (`prescricao_id`) REFERENCES `prescricoes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`paciente_id`) REFERENCES `pacientes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`profissional_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_aplicacoes_paciente_data` ON `aplicacoes` (`paciente_id`,`aplicado_em`);--> statement-breakpoint
CREATE TABLE `eventos_auditoria` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`usuario_id` integer,
	`acao` text NOT NULL,
	`entidade` text NOT NULL,
	`entidade_id` text DEFAULT '' NOT NULL,
	`detalhes` text DEFAULT '' NOT NULL,
	`criado_em` text NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_auditoria_data` ON `eventos_auditoria` (`criado_em`);--> statement-breakpoint
CREATE INDEX `idx_auditoria_entidade` ON `eventos_auditoria` (`entidade`,`entidade_id`);--> statement-breakpoint
CREATE TABLE `avaliacoes_sintomas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`paciente_id` integer NOT NULL,
	`sintoma_id` integer NOT NULL,
	`intensidade` integer NOT NULL,
	`observacao` text DEFAULT '' NOT NULL,
	`autor_id` integer NOT NULL,
	`avaliado_em` text NOT NULL,
	FOREIGN KEY (`paciente_id`) REFERENCES `pacientes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sintoma_id`) REFERENCES `sintomas_catalogo`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`autor_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_avaliacoes_paciente_data` ON `avaliacoes_sintomas` (`paciente_id`,`avaliado_em`);--> statement-breakpoint
CREATE TABLE `evolucoes_clinicas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`paciente_id` integer NOT NULL,
	`autor_id` integer NOT NULL,
	`texto` text NOT NULL,
	`tipo` text DEFAULT 'evolucao' NOT NULL,
	`evolucao_original_id` integer,
	`criado_em` text NOT NULL,
	FOREIGN KEY (`paciente_id`) REFERENCES `pacientes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`autor_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_evolucoes_paciente_data` ON `evolucoes_clinicas` (`paciente_id`,`criado_em`);--> statement-breakpoint
CREATE TABLE `itens_aplicacao` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`aplicacao_id` integer NOT NULL,
	`item_prescricao_id` integer NOT NULL,
	`lote_id` integer NOT NULL,
	`quantidade` real NOT NULL,
	FOREIGN KEY (`aplicacao_id`) REFERENCES `aplicacoes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_prescricao_id`) REFERENCES `itens_prescricao`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lote_id`) REFERENCES `lotes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_itens_aplicacao` ON `itens_aplicacao` (`aplicacao_id`);--> statement-breakpoint
CREATE TABLE `itens_prescricao` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`prescricao_id` integer NOT NULL,
	`produto_id` integer NOT NULL,
	`concentracao` text NOT NULL,
	`dose` text NOT NULL,
	`via` text NOT NULL,
	`quantidade` real NOT NULL,
	`instrucoes` text DEFAULT '' NOT NULL,
	`recorrencia_dias` integer,
	FOREIGN KEY (`prescricao_id`) REFERENCES `prescricoes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`produto_id`) REFERENCES `produtos_injetaveis`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_itens_prescricao` ON `itens_prescricao` (`prescricao_id`);--> statement-breakpoint
CREATE TABLE `lembretes_recorrencia` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`paciente_id` integer NOT NULL,
	`aplicacao_id` integer,
	`produto_id` integer,
	`data_prevista` text NOT NULL,
	`estado` text DEFAULT 'proximo' NOT NULL,
	`nota_administrativa` text DEFAULT '' NOT NULL,
	`atualizado_por` integer,
	`atualizado_em` text NOT NULL,
	FOREIGN KEY (`paciente_id`) REFERENCES `pacientes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`aplicacao_id`) REFERENCES `aplicacoes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`produto_id`) REFERENCES `produtos_injetaveis`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`atualizado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_lembretes_data_estado` ON `lembretes_recorrencia` (`data_prevista`,`estado`);--> statement-breakpoint
CREATE TABLE `lotes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`produto_id` integer NOT NULL,
	`numero` text NOT NULL,
	`validade` text NOT NULL,
	`recebido_em` text NOT NULL,
	`saldo` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`produto_id`) REFERENCES `produtos_injetaveis`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_lotes_produto_numero` ON `lotes` (`produto_id`,`numero`);--> statement-breakpoint
CREATE INDEX `idx_lotes_validade` ON `lotes` (`validade`);--> statement-breakpoint
CREATE TABLE `movimentacoes_estoque` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`produto_id` integer NOT NULL,
	`lote_id` integer NOT NULL,
	`tipo` text NOT NULL,
	`quantidade` real NOT NULL,
	`motivo` text DEFAULT '' NOT NULL,
	`aplicacao_id` integer,
	`usuario_id` integer NOT NULL,
	`criado_em` text NOT NULL,
	FOREIGN KEY (`produto_id`) REFERENCES `produtos_injetaveis`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lote_id`) REFERENCES `lotes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_movimentacoes_lote_data` ON `movimentacoes_estoque` (`lote_id`,`criado_em`);--> statement-breakpoint
CREATE TABLE `pacientes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nome` text NOT NULL,
	`nascimento` text NOT NULL,
	`cpf` text,
	`telefone` text NOT NULL,
	`endereco` text DEFAULT '' NOT NULL,
	`contato_emergencia` text DEFAULT '' NOT NULL,
	`observacoes_admin` text DEFAULT '' NOT NULL,
	`arquivado` integer DEFAULT false NOT NULL,
	`criado_em` text NOT NULL,
	`atualizado_em` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_pacientes_cpf` ON `pacientes` (`cpf`);--> statement-breakpoint
CREATE INDEX `idx_pacientes_nome` ON `pacientes` (`nome`);--> statement-breakpoint
CREATE INDEX `idx_pacientes_telefone` ON `pacientes` (`telefone`);--> statement-breakpoint
CREATE TABLE `prescricoes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`paciente_id` integer NOT NULL,
	`medico_id` integer NOT NULL,
	`estado` text DEFAULT 'rascunho' NOT NULL,
	`observacoes` text DEFAULT '' NOT NULL,
	`criado_em` text NOT NULL,
	`finalizado_em` text,
	`cancelado_em` text,
	FOREIGN KEY (`paciente_id`) REFERENCES `pacientes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`medico_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_prescricoes_paciente_estado` ON `prescricoes` (`paciente_id`,`estado`);--> statement-breakpoint
CREATE TABLE `produtos_injetaveis` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nome` text NOT NULL,
	`principio_ativo` text NOT NULL,
	`apresentacao` text NOT NULL,
	`unidade` text DEFAULT 'ampola' NOT NULL,
	`estoque_minimo` real DEFAULT 0 NOT NULL,
	`ativo` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_produtos_nome` ON `produtos_injetaveis` (`nome`);--> statement-breakpoint
CREATE TABLE `prontuarios` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`paciente_id` integer NOT NULL,
	`anamnese` text DEFAULT '' NOT NULL,
	`alergias` text DEFAULT '' NOT NULL,
	`condicoes` text DEFAULT '' NOT NULL,
	`medicamentos` text DEFAULT '' NOT NULL,
	`atualizado_por` integer NOT NULL,
	`atualizado_em` text NOT NULL,
	FOREIGN KEY (`paciente_id`) REFERENCES `pacientes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`atualizado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_prontuarios_paciente` ON `prontuarios` (`paciente_id`);--> statement-breakpoint
CREATE TABLE `sintomas_catalogo` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nome` text NOT NULL,
	`ativo` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sintomas_nome` ON `sintomas_catalogo` (`nome`);--> statement-breakpoint
CREATE TABLE `usuarios` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`external_id` text NOT NULL,
	`email` text NOT NULL,
	`nome` text NOT NULL,
	`papel` text NOT NULL,
	`ativo` integer DEFAULT true NOT NULL,
	`criado_em` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_usuarios_external_id` ON `usuarios` (`external_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_usuarios_email` ON `usuarios` (`email`);