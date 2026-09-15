"use client";

import {
  Activity, AlertTriangle, Archive, ArrowLeft, Ban, BarChart2, BellRing, Boxes, CalendarClock,
  Check, ChevronRight, ClipboardPlus, Edit2, FileHeart, FileText,
  History, LayoutDashboard, Loader2, Menu, MessageCircle, Minus, PackagePlus, Plus,
  Printer, RotateCcw, Search, Settings2, ShieldCheck, Sparkles, Stethoscope, Syringe,
  TableProperties, Trash2, TrendingDown, TrendingUp, UserPlus, UsersRound, X,
} from "lucide-react";
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";

type Section = "dashboard" | "patients" | "prescriptions" | "applications" | "stock" | "reminders" | "admin";

type User = {
  id: number;
  nome: string;
  email: string;
  papel: "medico_admin" | "recepcao";
  crm?: string | null;
  crmUf?: string | null;
};

type Patient = {
  id: number;
  nome: string;
  nascimento: string;
  cpf: string | null;
  telefone: string;
  endereco: string;
  contatoEmergencia: string;
  observacoesAdmin: string;
  arquivado?: boolean;
};

type Product = {
  id: number;
  nome: string;
  principioAtivo: string;
  apresentacao: string;
  unidade: string;
  estoqueMinimo: number;
  ativo?: boolean;
  balance?: number;
};

type Lot = {
  id: number;
  produtoId: number;
  numero: string;
  validade: string;
  recebidoEm: string;
  saldo: number;
};

type Reminder = {
  id: number;
  pacienteId: number;
  pacienteNome: string;
  telefone: string;
  produtoId: number | null;
  produtoNome: string | null;
  dataPrevista: string;
  estado: string;
  notaAdministrativa: string;
};

type PrescriptionItem = {
  id: number;
  produtoId: number;
  produtoNome: string;
  apresentacao: string;
  concentracao: string;
  dose: string;
  via: string;
  quantidade: number;
  instrucoes: string;
  recorrenciaDias: number | null;
};

type Prescription = {
  id: number;
  pacienteId: number;
  pacienteNome: string;
  medicoNome: string;
  medicoCrm?: string | null;
  medicoCrmUf?: string | null;
  estado: string;
  criadoEm: string;
  finalizadoEm: string | null;
  canceladoEm?: string | null;
  observacoes: string;
  items: PrescriptionItem[];
};

type ApplicationItem = {
  id: number;
  itemPrescricaoId: number;
  produtoId: number;
  produtoNome: string;
  loteId: number;
  loteNumero: string;
  quantidade: number;
};

type Application = {
  id: number;
  prescricaoId: number;
  pacienteId: number;
  pacienteNome: string;
  localAplicacao: string;
  observacoes: string;
  reacao: string;
  aplicadoEm: string;
  estornadaEm: string | null;
  items: ApplicationItem[];
};

type Symptom = {
  id: number;
  nome: string;
};

type Assessment = {
  id: number;
  pacienteId: number;
  sintomaId: number;
  sintomaNome: string;
  intensidade: number;
  observacao: string;
  avaliadoEm: string;
};

type Chart = {
  id: number;
  pacienteId: number;
  anamnese: string;
  alergias: string;
  condicoes: string;
  medicamentos: string;
  atualizadoEm: string;
};

type Evolution = {
  id: number;
  pacienteId: number;
  autorNome: string;
  texto: string;
  tipo: string;
  evolucaoOriginalId: number | null;
  criadoEm: string;
};

type StockMovement = {
  id: number;
  produtoId: number;
  produtoNome: string;
  loteId: number;
  loteNumero: string;
  tipo: string;
  quantidade: number;
  motivo: string;
  usuarioNome: string;
  criadoEm: string;
};

type AuditRow = {
  id: number;
  usuarioNome: string | null;
  acao: string;
  entidade: string;
  entidadeId: string;
  detalhes: string;
  criadoEm: string;
};

type UserRow = {
  id: number;
  nome: string;
  email: string;
  papel: "medico_admin" | "recepcao";
  crm?: string | null;
  crmUf?: string | null;
  ativo: boolean;
};

type Payload = {
  user: User;
  patients: Patient[];
  products: Product[];
  lots: Lot[];
  movements?: StockMovement[];
  reminders: Reminder[];
  prescriptions: Prescription[];
  applications: Application[];
  symptoms: Symptom[];
  assessments: Assessment[];
  charts: Chart[];
  evolutions: Evolution[];
  audit: AuditRow[];
  users: UserRow[];
  settings: { expiryAlertDays: number };
};

type DraftItem = {
  key: string;
  produtoId: string;
  dose: string;
  via: string;
  quantidade: string;
  instrucoes: string;
  recorrenciaDias: string;
};

const nav = [
  ["dashboard", "Visão geral", LayoutDashboard],
  ["patients", "Pacientes", UsersRound],
  ["prescriptions", "Prescrições", FileText],
  ["applications", "Aplicações", Syringe],
  ["stock", "Estoque", Boxes],
  ["reminders", "Recorrências", CalendarClock],
  ["admin", "Administração", Settings2],
] as const;

const empty: Payload = {
  user: { id: 0, nome: "", email: "", papel: "medico_admin" },
  patients: [],
  products: [],
  lots: [],
  movements: [],
  reminders: [],
  prescriptions: [],
  applications: [],
  symptoms: [],
  assessments: [],
  charts: [],
  evolutions: [],
  audit: [],
  users: [],
  settings: { expiryAlertDays: 60 },
};

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" });
const fmtDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "America/Fortaleza",
      }).format(new Date(value.includes("T") ? value : `${value}T12:00:00-03:00`))
    : "—";

const fmtDateTime = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Fortaleza",
  }).format(new Date(value));

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

const names = (items: { produtoNome: string }[]) => items.map((item) => item.produtoNome).join(" + ");
const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");

async function post(body: Record<string, unknown>) {
  const response = await fetch("/api/cti", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  let result: { error?: string } = {};
  try {
    result = (await response.json()) as { error?: string };
  } catch {
    result = { error: `Erro de comunicação (${response.status}: ${response.statusText || "Resposta inválida"})` };
  }
  if (!response.ok) throw new Error(result.error || "Não foi possível concluir a operação.");
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-200/75 bg-white shadow-[0_10px_35px_rgba(17,42,86,.055)] ${className}`}>
      {children}
    </section>
  );
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {hint && <span className="block text-xs leading-5 text-slate-500">{hint}</span>}
    </label>
  );
}

function PageHeading({
  eyebrow,
  title,
  text,
  action,
}: {
  eyebrow: string;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="text-xs font-bold uppercase tracking-[.16em] text-cyan-700">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
        <p className="mt-1.5 text-[0.95rem] text-slate-500">{text}</p>
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </div>
  );
}

function Status({ status }: { status: string }) {
  const map: Record<string, string> = {
    finalizada: "bg-blue-50 text-blue-700 ring-blue-100",
    parcialmente_aplicada: "bg-amber-50 text-amber-800 ring-amber-100",
    aplicada: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    cancelada: "bg-rose-50 text-rose-700 ring-rose-100",
    proximo: "bg-cyan-50 text-cyan-800 ring-cyan-100",
    vencido: "bg-rose-50 text-rose-700 ring-rose-100",
    contatado: "bg-violet-50 text-violet-700 ring-violet-100",
    concluido: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ring-1 ${map[status] ?? "bg-slate-100 text-slate-600 ring-slate-200"}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

function Empty({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: typeof Search;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid min-h-60 place-items-center px-6 py-10 text-center">
      <div>
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="mt-4 font-semibold text-slate-900">{title}</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-500">{text}</p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}

export function CtiApp({ signedInName }: { signedInName: string }) {
  const [data, setData] = useState<Payload>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [section, setSection] = useState<Section>("dashboard");
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState("");

  const [patientId, setPatientId] = useState<number | null>(null);
  const [patientDialog, setPatientDialog] = useState(false);
  const [editPatient, setEditPatient] = useState<Patient | null>(null);

  const [stockDialog, setStockDialog] = useState(false);
  const [stockAdjustDialog, setStockAdjustDialog] = useState(false);
  const [productDialog, setProductDialog] = useState(false);

  const [rxDialog, setRxDialog] = useState(false);
  const [cancelRx, setCancelRx] = useState<Prescription | null>(null);
  const [applyRx, setApplyRx] = useState<Prescription | null>(null);
  const [reverseApp, setReverseApp] = useState<Application | null>(null);
  const [rescheduleReminder, setRescheduleReminder] = useState<Reminder | null>(null);
  const [printRx, setPrintRx] = useState<Prescription | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!printRx) return;
    const handleAfterPrint = () => setPrintRx(null);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, [printRx]);

  const reload = useCallback(async () => {
    try {
      const response = await fetch("/api/cti", { cache: "no-store" });
      let payload: (Payload & { error?: string }) | null = null;
      try {
        payload = (await response.json()) as Payload & { error?: string };
      } catch {
        throw new Error(`Falha de comunicação com o servidor (${response.status})`);
      }
      if (!response.ok) throw new Error(payload?.error || "Erro ao atualizar dados.");
      if (payload) setData(payload);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Erro ao atualizar dados.");
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const response = await fetch("/api/cti", { cache: "no-store" });
        let payload: (Payload & { error?: string }) | null = null;
        try {
          payload = (await response.json()) as Payload & { error?: string };
        } catch {
          throw new Error(`Falha ao conectar ao servidor (${response.status})`);
        }
        if (!response.ok) throw new Error(payload?.error || "Não foi possível carregar o sistema.");
        if (!ignore && payload) {
          setData(payload);
          setError("");
        }
      } catch (reason) {
        if (!ignore) {
          setError(reason instanceof Error ? reason.message : "Não foi possível carregar o sistema.");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    void init();
    return () => {
      ignore = true;
    };
  }, []);

  const run = async (action: Record<string, unknown>, success: string, close?: () => void) => {
    setSaving(true);
    try {
      await post(action);
      toast.success(success);
      close?.();
      await reload();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const doctor = data.user.papel === "medico_admin";
  const userName = data.user.nome || signedInName;
  const userCrmDisplay = data.user.crm ? `CRM ${data.user.crm}/${data.user.crmUf || ""}` : null;

  const selectedPatient = data.patients.find((patient) => patient.id === patientId) ?? null;
  const activePatients = data.patients.filter((p) => !p.arquivado);
  const archivedPatients = data.patients.filter((p) => p.arquivado);

  const balances = data.products.map((product) => ({
    ...product,
    balance: data.lots.filter((lot) => lot.produtoId === product.id).reduce((sum, lot) => sum + lot.saldo, 0),
  }));

  const lowStock = balances.filter((product) => product.balance <= product.estoqueMinimo);

  const expiryLimit = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + data.settings.expiryAlertDays);
    return d.toISOString().slice(0, 10);
  }, [data.settings.expiryAlertDays]);

  const expiring = data.lots.filter(
    (lot) => lot.saldo > 0 && lot.validade <= expiryLimit
  );
  const pending = data.prescriptions.filter((rx) => ["finalizada", "parcialmente_aplicada"].includes(rx.estado));
  const openReminders = data.reminders.filter((reminder) => !["concluido", "cancelado"].includes(reminder.estado));

  const changeSection = (next: Section) => {
    setSection(next);
    setMenu(false);
    setPatientId(null);
  };

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f6f9fc]">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-cyan-700" />
          <p className="mt-3 text-sm text-slate-500">Abrindo ambiente clínico protegido…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f6f9fc] p-6">
        <Panel className="max-w-md p-7 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-rose-500" />
          <h1 className="mt-4 text-xl font-semibold">Não foi possível abrir o sistema</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{error}</p>
          <Button
            className="mt-5"
            onClick={() => {
              setLoading(true);
              void reload();
            }}
          >
            Tentar novamente
          </Button>
        </Panel>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f9fc] text-slate-900 print:min-h-0 print:bg-white print:p-0">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[276px] flex-col bg-[#071c42] px-4 py-5 text-white shadow-2xl transition-transform duration-300 lg:translate-x-0 print:hidden ${
          menu ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 px-3 pb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="CTI" className="h-12 w-12 rounded-2xl bg-white object-contain p-1.5" />
          <div>
            <strong className="block text-lg tracking-[.18em]">CTI</strong>
            <span className="text-xs text-cyan-200">Terapias Injetáveis</span>
          </div>
          <button
            className="ml-auto rounded-lg p-2 text-blue-200 lg:hidden"
            onClick={() => setMenu(false)}
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="space-y-1" aria-label="Navegação principal">
          {nav
            .filter(([id]) => id !== "admin" || doctor)
            .map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => changeSection(id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-semibold transition ${
                  section === id
                    ? "bg-white text-[#071c42] shadow-[0_8px_20px_rgba(0,0,0,.18)]"
                    : "text-blue-100 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" />
                {label}
              </button>
            ))}
        </nav>

        <div className="mt-auto rounded-2xl border border-cyan-300/15 bg-white/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-cyan-300" />
            Ambiente rastreável
          </div>
          <p className="mt-1.5 text-xs leading-5 text-blue-100">
            {doctor ? (userCrmDisplay ? `${userName} · ${userCrmDisplay}` : `${userName} · CRM pendente`) : "Acesso recepção e triagem."}
          </p>
        </div>
      </aside>

      {menu && <button aria-label="Fechar menu" className="fixed inset-0 z-30 bg-slate-950/45 lg:hidden" onClick={() => setMenu(false)} />}

      {/* Main Content Area */}
      <section className="min-h-screen lg:pl-[276px] print:hidden">
        <header className="sticky top-0 z-20 flex h-[76px] items-center gap-3 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl sm:px-7 lg:px-9 print:hidden">
          <button className="rounded-xl border border-slate-200 bg-white p-2.5 lg:hidden" aria-label="Abrir menu" onClick={() => setMenu(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="relative hidden max-w-md flex-1 sm:block">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              aria-label="Buscar paciente"
              value={search}
              onFocus={() => setSection("patients")}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 rounded-xl border-slate-200 bg-slate-50 pl-10"
              placeholder="Buscar paciente por nome, CPF ou telefone"
            />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button
              aria-label="Abrir recorrências"
              onClick={() => setSection("reminders")}
              className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50"
            >
              <BellRing className="h-5 w-5" />
              {openReminders.length > 0 && (
                <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                  {openReminders.length}
                </span>
              )}
            </button>
            <div className="hidden text-right sm:block">
              <strong className="block text-sm">{userName}</strong>
              <span className="text-xs text-slate-500">
                {doctor ? (userCrmDisplay ? `Médico · ${userCrmDisplay}` : "Médico administrador") : "Recepção"}
              </span>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#07265b] to-cyan-700 text-sm font-bold text-white shadow-sm">
              {initials(userName)}
            </span>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] p-4 sm:p-7 lg:p-9 print:hidden">
          {section === "dashboard" && (
            <Dashboard
              data={data}
              lowStock={lowStock.length}
              expiring={expiring.length}
              pending={pending.length}
              onSection={changeSection}
              onNewPatient={() => setPatientDialog(true)}
              onNewRx={() => setRxDialog(true)}
              doctor={doctor}
              userName={userName}
            />
          )}

          {section === "patients" && !selectedPatient && (
            <Patients
              activeRows={activePatients}
              archivedRows={archivedPatients}
              search={search}
              setSearch={setSearch}
              onNew={() => setPatientDialog(true)}
              onOpen={setPatientId}
              run={run}
              saving={saving}
            />
          )}

          {section === "patients" && selectedPatient && (
            <PatientDetail
              patient={selectedPatient}
              data={data}
              doctor={doctor}
              run={run}
              saving={saving}
              onBack={() => setPatientId(null)}
              onEdit={(p) => setEditPatient(p)}
              onNewRx={() => setRxDialog(true)}
              onPrint={(rx) => {
                setPrintRx(rx);
                window.setTimeout(() => window.print(), 120);
              }}
            />
          )}

          {section === "prescriptions" && (
            <Prescriptions
              rows={data.prescriptions}
              doctor={doctor}
              onNew={() => setRxDialog(true)}
              onCancel={(rx) => setCancelRx(rx)}
              onPrint={(rx) => {
                setPrintRx(rx);
                window.setTimeout(() => window.print(), 120);
              }}
            />
          )}

          {section === "applications" && (
            <Applications
              pending={pending}
              applied={data.applications}
              lots={data.lots}
              doctor={doctor}
              onApply={setApplyRx}
              onReverse={(app) => setReverseApp(app)}
            />
          )}

          {section === "stock" && (
            <Stock
              products={balances}
              lots={data.lots}
              movements={data.movements || []}
              doctor={doctor}
              onReceive={() => setStockDialog(true)}
              onAdjust={() => setStockAdjustDialog(true)}
              onNewProduct={() => setProductDialog(true)}
              run={run}
              saving={saving}
            />
          )}

          {section === "reminders" && (
            <Reminders
              rows={data.reminders}
              run={run}
              saving={saving}
              onReschedule={(rem) => setRescheduleReminder(rem)}
            />
          )}

          {section === "admin" && (
            <Admin data={data} doctor={doctor} run={run} saving={saving} />
          )}
        </div>
      </section>

      {/* Dialogs */}
      <PatientDialog open={patientDialog} setOpen={setPatientDialog} run={run} saving={saving} />
      <EditPatientDialog patient={editPatient} setPatient={setEditPatient} run={run} saving={saving} />
      <StockDialog open={stockDialog} setOpen={setStockDialog} products={data.products.filter((p) => p.ativo !== false)} run={run} saving={saving} />
      <StockAdjustDialog open={stockAdjustDialog} setOpen={setStockAdjustDialog} products={data.products} lots={data.lots} run={run} saving={saving} />
      <ProductDialog open={productDialog} setOpen={setProductDialog} run={run} saving={saving} />
      <PrescriptionDialog open={rxDialog} setOpen={setRxDialog} patients={activePatients} products={data.products.filter((p) => p.ativo !== false)} charts={data.charts} run={run} saving={saving} />
      <CancelPrescriptionDialog rx={cancelRx} setRx={setCancelRx} run={run} saving={saving} />
      <ApplicationDialog rx={applyRx} setRx={setApplyRx} lots={data.lots} applications={data.applications} run={run} saving={saving} />
      <ReverseApplicationDialog app={reverseApp} setApp={setReverseApp} run={run} saving={saving} />
      <RescheduleDialog reminder={rescheduleReminder} setReminder={setRescheduleReminder} run={run} saving={saving} />

      {/* Print View */}
      {printRx && <PrescriptionPrint rx={printRx} onClose={() => setPrintRx(null)} />}
      <Toaster position="top-right" richColors />
    </main>
  );
}

// -------------------------------------------------------------------------------------------------
// Subcomponents
// -------------------------------------------------------------------------------------------------

function Dashboard({
  data,
  lowStock,
  expiring,
  pending,
  onSection,
  onNewPatient,
  onNewRx,
  doctor,
  userName,
}: {
  data: Payload;
  lowStock: number;
  expiring: number;
  pending: number;
  onSection: (section: Section) => void;
  onNewPatient: () => void;
  onNewRx: () => void;
  doctor: boolean;
  userName: string;
}) {
  const overdue = data.reminders.filter((item) => item.dataPrevista < today() && !["concluido", "cancelado"].includes(item.estado));
  const cards = [
    ["Retornos vencidos", overdue.length, "Contato prioritário", BellRing, "reminders"],
    ["Aplicações pendentes", pending, "Aguardando confirmação", Syringe, "applications"],
    ["Estoque baixo", lowStock, "No mínimo ou abaixo", Boxes, "stock"],
    ["Lotes a vencer", expiring, "Nos próximos 60 dias", AlertTriangle, "stock"],
  ] as const;

  return (
    <>
      <PageHeading
        eyebrow="Operação diária"
        title={`Olá, ${userName.split(" ")[0]}`}
        text="Controle unificado de prescrições, aplicações, lotes e pacientes."
        action={
          <>
            <Button variant="outline" onClick={onNewPatient}>
              <UserPlus />
              Novo paciente
            </Button>
            {doctor && (
              <Button onClick={onNewRx}>
                <ClipboardPlus />
                Nova prescrição
              </Button>
            )}
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, detail, Icon, sec]) => (
          <button
            key={label}
            onClick={() => onSection(sec)}
            className="rounded-2xl border border-slate-200/80 bg-white p-5 text-left shadow-[0_10px_35px_rgba(17,42,86,.055)] transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-lg"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-50 text-cyan-700">
              <Icon className="h-5 w-5" />
            </span>
            <strong className="mt-5 block text-2xl tracking-tight">{value}</strong>
            <span className="mt-1 block text-sm font-semibold text-slate-700">{label}</span>
            <span className="mt-1 block text-xs text-slate-500">{detail}</span>
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
        <Panel>
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
            <div>
              <h2 className="font-semibold">Próximos retornos e acompanhamentos</h2>
              <p className="mt-1 text-sm text-slate-500">Recorrências de injetáveis programadas para contato.</p>
            </div>
            <button className="text-sm font-semibold text-cyan-700 hover:underline" onClick={() => onSection("reminders")}>
              Ver todos
            </button>
          </div>
          {data.reminders.length ? (
            <div className="divide-y divide-slate-100">
              {data.reminders.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-6 py-4">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-xs font-bold text-slate-700">
                    {initials(item.pacienteNome)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate text-sm">{item.pacienteNome}</strong>
                    <span className="text-xs text-slate-500">{item.telefone} · {item.produtoNome ?? "Aplicação"}</span>
                  </div>
                  <span className="hidden text-sm text-slate-600 sm:block">{fmtDate(item.dataPrevista)}</span>
                  <Status status={item.dataPrevista < today() && item.estado === "proximo" ? "vencido" : item.estado} />
                </div>
              ))}
            </div>
          ) : (
            <Empty icon={CalendarClock} title="Nenhum retorno programado" text="Os retornos serão gerados automaticamente após aplicações recorrentes." />
          )}
        </Panel>

        <Panel className="bg-[linear-gradient(135deg,#071c42_0%,#0d4f78_100%)] p-6 text-white flex flex-col justify-between">
          <div>
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-cyan-200">
              <Stethoscope className="h-5 w-5" />
            </span>
            <h2 className="mt-8 text-xl font-semibold">Rastreabilidade Sanitária Rigorosa</h2>
            <p className="mt-2 text-sm leading-6 text-blue-100">
              Cada ampola aplicada baixa do lote com vencimento mais próximo (FEFO), garantindo conformidade médica e auditoria completa.
            </p>
          </div>
          {doctor && (
            <Button className="mt-7 bg-white text-[#071c42] hover:bg-cyan-50" onClick={onNewRx}>
              Criar prescrição
            </Button>
          )}
        </Panel>
      </div>
    </>
  );
}

function Patients({
  activeRows,
  archivedRows,
  search,
  setSearch,
  onNew,
  onOpen,
  run,
  saving,
}: {
  activeRows: Patient[];
  archivedRows: Patient[];
  search: string;
  setSearch: (value: string) => void;
  onNew: () => void;
  onOpen: (id: number) => void;
  run: (action: Record<string, unknown>, success: string) => Promise<void>;
  saving: boolean;
}) {
  const [tab, setTab] = useState<"active" | "archived">("active");
  const currentList = tab === "active" ? activeRows : archivedRows;
  const filtered = currentList.filter((p) =>
    `${p.nome} ${p.cpf ?? ""} ${p.telefone}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <PageHeading
        eyebrow="Cadastro e acompanhamento"
        title="Pacientes"
        text="Histórico clínico completo, prontuário, marcadores e rastreabilidade de aplicações."
        action={
          <Button onClick={onNew}>
            <UserPlus />
            Novo paciente
          </Button>
        }
      />
      <Panel>
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center">
          <div className="relative max-w-xl flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-10"
              placeholder="Buscar por nome, CPF ou telefone"
            />
          </div>
          <div className="flex rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => setTab("active")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                tab === "active" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Ativos ({activeRows.length})
            </button>
            <button
              onClick={() => setTab("archived")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                tab === "archived" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Arquivados ({archivedRows.length})
            </button>
          </div>
        </div>

        {filtered.length ? (
          <div className="divide-y divide-slate-100">
            {filtered.map((patient) => (
              <div
                key={patient.id}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 transition hover:bg-cyan-50/45"
              >
                <button
                  onClick={() => onOpen(patient.id)}
                  className="flex min-w-0 flex-1 items-center gap-4 text-left"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#eaf4fa] text-sm font-bold text-[#0b4c73]">
                    {initials(patient.nome)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate">{patient.nome}</strong>
                    <span className="text-sm text-slate-500">Nascimento: {fmtDate(patient.nascimento)}</span>
                  </div>
                  <div className="hidden text-right sm:block">
                    <span className="block text-sm font-medium">{patient.telefone}</span>
                    <span className="text-xs text-slate-400">{patient.cpf ? `CPF ${patient.cpf}` : "CPF não informado"}</span>
                  </div>
                </button>

                {tab === "archived" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={saving}
                    onClick={() => void run({ action: "unarchive_patient", id: patient.id }, "Paciente restaurado com sucesso.")}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Restaurar
                  </Button>
                ) : (
                  <button onClick={() => onOpen(patient.id)} className="p-2 text-slate-400 hover:text-slate-600">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Empty
            icon={UsersRound}
            title={tab === "active" ? "Nenhum paciente ativo encontrado" : "Nenhum paciente arquivado"}
            text={search ? "Tente outro termo de busca." : "Cadastre o primeiro paciente para iniciar o acompanhamento."}
            action={!search && tab === "active" ? <Button onClick={onNew}>Cadastrar paciente</Button> : undefined}
          />
        )}
      </Panel>
    </>
  );
}

function PatientDetail({
  patient,
  data,
  doctor,
  run,
  saving,
  onBack,
  onEdit,
  onNewRx,
  onPrint,
}: {
  patient: Patient;
  data: Payload;
  doctor: boolean;
  run: (action: Record<string, unknown>, success: string, close?: () => void) => Promise<void>;
  saving: boolean;
  onBack: () => void;
  onEdit: (patient: Patient) => void;
  onNewRx: () => void;
  onPrint: (rx: Prescription) => void;
}) {
  const chart = data.charts.find((item) => item.pacienteId === patient.id);
  const evolutions = data.evolutions.filter((item) => item.pacienteId === patient.id);
  const assessments = data.assessments.filter((item) => item.pacienteId === patient.id);
  const patientPrescriptions = data.prescriptions.filter((item) => item.pacienteId === patient.id);
  const patientApplications = data.applications.filter((item) => item.pacienteId === patient.id);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [evolutionText, setEvolutionText] = useState("");
  const [historyTab, setHistoryTab] = useState<"timeline" | "matrix" | "chart">("timeline");

  // Group assessments into chronological sessions (oldest to newest)
  const sessions = useMemo(() => {
    if (!assessments.length) return [];
    const sorted = [...assessments].sort(
      (a, b) => new Date(a.avaliadoEm).getTime() - new Date(b.avaliadoEm).getTime()
    );
    const list: {
      id: string;
      timestamp: string;
      formattedDate: string;
      formattedTime: string;
      scores: Record<number, number>;
      scoresByName: Record<string, number>;
      totalScore: number;
      avgScore: number;
      count: number;
    }[] = [];

    sorted.forEach((item) => {
      const itemTime = new Date(item.avaliadoEm).getTime();
      const last = list[list.length - 1];
      // Group items evaluated within 15 minutes of each other
      if (last && Math.abs(itemTime - new Date(last.timestamp).getTime()) <= 15 * 60 * 1000) {
        last.scores[item.sintomaId] = item.intensidade;
        last.scoresByName[item.sintomaNome] = item.intensidade;
      } else {
        list.push({
          id: item.avaliadoEm.slice(0, 16),
          timestamp: item.avaliadoEm,
          formattedDate: fmtDate(item.avaliadoEm),
          formattedTime: fmtDateTime(item.avaliadoEm).split(" às ")[1] || "",
          scores: { [item.sintomaId]: item.intensidade },
          scoresByName: { [item.sintomaNome]: item.intensidade },
          totalScore: 0,
          avgScore: 0,
          count: 0,
        });
      }
    });

    list.forEach((s) => {
      const vals = Object.values(s.scores);
      s.totalScore = vals.reduce((acc, v) => acc + v, 0);
      s.count = vals.length;
      s.avgScore = vals.length ? Math.round((s.totalScore / vals.length) * 10) / 10 : 0;
    });

    return list;
  }, [assessments]);

  // Unified consultation visits (combining evolutions and symptom sessions chronologically, newest first)
  const consultationVisits = useMemo(() => {
    type Visit = {
      key: string;
      timestamp: string;
      formattedDate: string;
      formattedTime: string;
      evolution?: (typeof evolutions)[0];
      session?: (typeof sessions)[0];
      sessionIndex?: number;
      previousSession?: (typeof sessions)[0];
    };

    const visits: Visit[] = [];
    const usedEvolutions = new Set<number>();

    sessions.forEach((sess, idx) => {
      const sessTime = new Date(sess.timestamp).getTime();
      const match = evolutions.find((ev) => {
        if (usedEvolutions.has(ev.id)) return false;
        const evTime = new Date(ev.criadoEm).getTime();
        return Math.abs(evTime - sessTime) <= 30 * 60 * 1000;
      });
      if (match) usedEvolutions.add(match.id);

      visits.push({
        key: `sess-${sess.id}`,
        timestamp: sess.timestamp,
        formattedDate: sess.formattedDate,
        formattedTime: sess.formattedTime,
        evolution: match,
        session: sess,
        sessionIndex: idx,
        previousSession: idx > 0 ? sessions[idx - 1] : undefined,
      });
    });

    evolutions.forEach((ev) => {
      if (usedEvolutions.has(ev.id)) return;
      visits.push({
        key: `ev-${ev.id}`,
        timestamp: ev.criadoEm,
        formattedDate: fmtDate(ev.criadoEm),
        formattedTime: fmtDateTime(ev.criadoEm).split(" às ")[1] || "",
        evolution: ev,
      });
    });

    return visits.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [sessions, evolutions]);

  // Overall Clinical Outcome Metrics
  const clinicalMetrics = useMemo(() => {
    if (!sessions.length) {
      return {
        hasData: false,
        sessionsCount: 0,
        baselineScore: 0,
        latestScore: 0,
        totalReliefPct: 0,
        statusLabel: "Sem dados clínicos",
        statusColor: "text-slate-600 bg-slate-50 border-slate-200",
        topImprovedSymptom: null as { name: string; drop: number } | null,
      };
    }

    const baseline = sessions[0];
    const latest = sessions[sessions.length - 1];
    const baselineScore = baseline.totalScore;
    const latestScore = latest.totalScore;
    const diff = baselineScore - latestScore;
    const totalReliefPct = baselineScore > 0 ? Math.round((diff / baselineScore) * 100) : 0;

    let statusLabel = "Linha de Base Estabelecida";
    let statusColor = "text-cyan-800 bg-cyan-50 border-cyan-200";

    if (sessions.length > 1) {
      if (totalReliefPct >= 65) {
        statusLabel = "Excelente Resposta (Remissão)";
        statusColor = "text-emerald-800 bg-emerald-50 border-emerald-300";
      } else if (totalReliefPct >= 35) {
        statusLabel = "Melhora Clínica Significativa";
        statusColor = "text-cyan-800 bg-cyan-50 border-cyan-300";
      } else if (totalReliefPct >= 10) {
        statusLabel = "Melhora Moderada";
        statusColor = "text-teal-800 bg-teal-50 border-teal-300";
      } else if (totalReliefPct >= -10) {
        statusLabel = "Quadro Clínico Estável";
        statusColor = "text-amber-800 bg-amber-50 border-amber-300";
      } else {
        statusLabel = "Alerta: Agravamento dos Sintomas";
        statusColor = "text-rose-800 bg-rose-50 border-rose-300";
      }
    }

    let topImprovedSymptom: { name: string; drop: number } | null = null;
    let maxDrop = 0;
    data.symptoms.forEach((sym) => {
      const bVal = baseline.scores[sym.id];
      const lVal = latest.scores[sym.id];
      if (bVal !== undefined && lVal !== undefined) {
        const drop = bVal - lVal;
        if (drop > maxDrop) {
          maxDrop = drop;
          topImprovedSymptom = { name: sym.nome, drop };
        }
      }
    });

    return {
      hasData: true,
      sessionsCount: sessions.length,
      baselineScore,
      latestScore,
      totalReliefPct,
      statusLabel,
      statusColor,
      topImprovedSymptom,
    };
  }, [sessions, data.symptoms]);

  // Recharts multi-line progression
  const chartData = useMemo(() => {
    return sessions.map((sess, idx) => {
      const entry: Record<string, string | number> = {
        name: `C${idx + 1} (${sess.formattedDate.slice(0, 5)})`,
        date: sess.formattedDate,
        "Total (ISS)": sess.totalScore,
      };
      data.symptoms.forEach((s) => {
        if (sess.scores[s.id] !== undefined) {
          entry[s.nome] = sess.scores[s.id];
        }
      });
      return entry;
    });
  }, [sessions, data.symptoms]);

  // Symptoms tracked across all sessions
  const symptomsTracked = useMemo(() => {
    return data.symptoms.filter((s) => sessions.some((sess) => sess.scores[s.id] !== undefined));
  }, [data.symptoms, sessions]);

  // Baseline Bar Chart data for single session
  const baselineBarData = useMemo(() => {
    if (!sessions.length) return [];
    const latest = sessions[sessions.length - 1];
    return data.symptoms
      .filter((s) => latest.scores[s.id] !== undefined)
      .map((s) => ({
        sintoma: s.nome,
        intensidade: latest.scores[s.id],
      }));
  }, [sessions, data.symptoms]);

  // Delta comparison per symptom (baseline vs latest)
  const symptomDeltaComparison = useMemo(() => {
    if (sessions.length < 2) return [];
    const baseline = sessions[0];
    const latest = sessions[sessions.length - 1];
    return symptomsTracked.map((s) => {
      const bVal = baseline.scores[s.id] ?? 0;
      const lVal = latest.scores[s.id] ?? 0;
      return {
        sintoma: s.nome,
        Baseline: bVal,
        Atual: lVal,
        delta: lVal - bVal,
      };
    });
  }, [sessions, symptomsTracked]);

  const colors = ["#0891b2", "#2563eb", "#ea580c", "#16a34a", "#9333ea", "#e11d48", "#d97706", "#0284c7"];

  const saveChart = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void run(
      {
        action: "save_chart",
        pacienteId: patient.id,
        anamnese: form.get("anamnese"),
        alergias: form.get("alergias"),
        condicoes: form.get("condicoes"),
        medicamentos: form.get("medicamentos"),
      },
      "Prontuário atualizado."
    );
  };

  return (
    <>
      <button onClick={onBack} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-cyan-700">
        <ArrowLeft className="h-4 w-4" />
        Voltar para pacientes
      </button>

      {/* Header Profile Card */}
      <div className="rounded-2xl bg-[#071c42] px-6 py-7 text-white sm:px-8 shadow-xl">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10 text-lg font-bold text-cyan-100">
              {initials(patient.nome)}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="truncate text-2xl font-semibold">{patient.nome}</h1>
                {patient.arquivado && <span className="rounded-md bg-rose-500/20 px-2 py-0.5 text-xs font-bold text-rose-200">Arquivado</span>}
              </div>
              <p className="mt-1 text-sm text-blue-100">
                {patient.telefone} · Nascimento {fmtDate(patient.nascimento)} {patient.cpf ? `· CPF ${patient.cpf}` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20" onClick={() => onEdit(patient)}>
              <Edit2 className="h-4 w-4" />
              Editar dados
            </Button>
            {patient.arquivado ? (
              <Button
                variant="outline"
                className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                disabled={saving}
                onClick={() => void run({ action: "unarchive_patient", id: patient.id }, "Paciente restaurado com sucesso.")}
              >
                <RotateCcw className="h-4 w-4" />
                Restaurar
              </Button>
            ) : (
              <Button
                variant="outline"
                className="border-rose-300/30 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30"
                disabled={saving}
                onClick={() => {
                  if (confirm(`Deseja arquivar o paciente ${patient.nome}?`)) {
                    void run({ action: "archive_patient", id: patient.id }, "Paciente arquivado.");
                  }
                }}
              >
                <Archive className="h-4 w-4" />
                Arquivar
              </Button>
            )}
            {doctor && !patient.arquivado && (
              <Button className="bg-white text-[#071c42] hover:bg-cyan-50" onClick={onNewRx}>
                <ClipboardPlus />
                Nova prescrição
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Allergy Alert Banner */}
      {chart?.alergias ? (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <strong className="block font-semibold">Alergias relatadas pelo paciente:</strong>
            <p className="mt-0.5 text-sm leading-6">{chart.alergias}</p>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          Nenhuma alergia restritiva registrada no prontuário.
        </div>
      )}

      {/* Clinical Record & Vitamin Timeline */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        {doctor ? (
          <Panel className="p-6">
            <h2 className="font-semibold text-slate-900">Prontuário clínico</h2>
            <p className="mt-1 text-sm text-slate-500">Histórico de saúde, alergias e contraindicações.</p>
            <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={saveChart}>
              <Field label="Anamnese">
                <Textarea name="anamnese" rows={3} defaultValue={chart?.anamnese} placeholder="Histórico clínico e queixas principais" />
              </Field>
              <Field label="Alergias (destaque na prescrição)">
                <Textarea name="alergias" rows={3} defaultValue={chart?.alergias} placeholder="Ex.: Dipirona, iodo, fenol..." />
              </Field>
              <Field label="Condições clínicas preexistentes">
                <Textarea name="condicoes" rows={3} defaultValue={chart?.condicoes} placeholder="Hipertensão, diabetes, deficiências..." />
              </Field>
              <Field label="Medicamentos em uso">
                <Textarea name="medicamentos" rows={3} defaultValue={chart?.medicamentos} placeholder="Medicamentos contínuos ou suplementos" />
              </Field>
              <div className="flex justify-end sm:col-span-2">
                <Button disabled={saving}>Salvar prontuário</Button>
              </div>
            </form>
          </Panel>
        ) : (
          <Panel className="p-6">
            <h2 className="font-semibold text-slate-900">Dados administrativos</h2>
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Endereço</dt>
                <dd className="mt-1 font-medium">{patient.endereco || "Não informado"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Contato de emergência</dt>
                <dd className="mt-1 font-medium">{patient.contatoEmergencia || "Não informado"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-slate-500">Observações da recepção</dt>
                <dd className="mt-1 font-medium">{patient.observacoesAdmin || "Nenhuma observação registrada."}</dd>
              </div>
            </dl>
          </Panel>
        )}

        <Panel className="p-6">
          <h2 className="font-semibold text-slate-900">Linha do tempo de aplicações</h2>
          <div className="mt-5 space-y-4 max-h-[380px] overflow-y-auto pr-1">
            {patientApplications.slice(0, 8).map((application) => (
              <div
                key={application.id}
                className={`border-l-2 pl-4 py-1 ${application.estornadaEm ? "border-rose-400 opacity-60" : "border-cyan-500"}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold ${application.estornadaEm ? "text-rose-600" : "text-cyan-700"}`}>
                    {application.estornadaEm ? "ESTORNADA" : "APLICADA"} · {fmtDate(application.aplicadoEm)}
                  </span>
                </div>
                <strong className="mt-1 block text-sm">{names(application.items)}</strong>
                <span className="text-xs text-slate-500">
                  {application.items.map((item) => `Lote ${item.loteNumero}`).join(" · ")} · {application.localAplicacao || "Local não informado"}
                </span>
              </div>
            ))}
            {!patientApplications.length && <p className="text-sm text-slate-500">Nenhuma aplicação registrada para este paciente.</p>}
          </div>
        </Panel>
      </div>

      {/* Clinical Evolutions & Multiconsultation Symptom Tracking */}
      {doctor && (
        <div className="mt-8 space-y-6">
          {/* Top Global Outcome Metrics (KPIs) */}
          {clinicalMetrics.hasData && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Panel className="p-4 bg-gradient-to-br from-white to-cyan-50/30 border-cyan-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Índice Gravidade (ISS)</span>
                  <Activity className="h-4 w-4 text-cyan-600" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900">{clinicalMetrics.latestScore}</span>
                  <span className="text-xs text-slate-500">pts atuais</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Baseline (1ª consulta): <strong className="text-slate-700">{clinicalMetrics.baselineScore} pts</strong>
                </div>
              </Panel>

              <Panel className="p-4 bg-gradient-to-br from-white to-emerald-50/30 border-emerald-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Alívio Sintomático</span>
                  <TrendingDown className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className={`text-2xl font-black ${clinicalMetrics.totalReliefPct >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                    {clinicalMetrics.totalReliefPct >= 0 ? `↓ ${clinicalMetrics.totalReliefPct}%` : `↑ ${Math.abs(clinicalMetrics.totalReliefPct)}%`}
                  </span>
                  <span className="text-xs text-slate-500">desde o início</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full ${clinicalMetrics.totalReliefPct >= 0 ? "bg-emerald-500" : "bg-rose-500"}`}
                    style={{ width: `${Math.min(100, Math.max(5, Math.abs(clinicalMetrics.totalReliefPct)))}%` }}
                  />
                </div>
              </Panel>

              <Panel className="p-4 bg-gradient-to-br from-white to-blue-50/30 border-blue-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Resposta Terapêutica</span>
                  <Sparkles className="h-4 w-4 text-blue-600" />
                </div>
                <div className="mt-2">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${clinicalMetrics.statusColor}`}>
                    {clinicalMetrics.statusLabel}
                  </span>
                </div>
                {clinicalMetrics.topImprovedSymptom && (
                  <p className="mt-2 text-xs text-slate-600 truncate" title={`${clinicalMetrics.topImprovedSymptom.name} (-${clinicalMetrics.topImprovedSymptom.drop} pts)`}>
                    Maior resposta: <strong>{clinicalMetrics.topImprovedSymptom.name}</strong> (-{clinicalMetrics.topImprovedSymptom.drop} pts)
                  </p>
                )}
              </Panel>

              <Panel className="p-4 bg-gradient-to-br from-white to-purple-50/30 border-purple-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Histórico de Consultas</span>
                  <History className="h-4 w-4 text-purple-600" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900">{sessions.length}</span>
                  <span className="text-xs text-slate-500">sessões avaliadas</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {sessions.length ? `Última: ${sessions[sessions.length - 1].formattedDate}` : "Nenhuma consulta"}
                </div>
              </Panel>
            </div>
          )}

          {/* Unified Consultation Entry Card (New Evolution + Symptoms) */}
          <Panel className="p-6 border-cyan-200/80 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-800">
                  <Stethoscope className="h-3.5 w-3.5 text-cyan-600" />
                  Nova Consulta & Avaliação Clínica Integrada
                </div>
                <h2 className="mt-2 text-lg font-bold text-slate-900">Registro de Consulta Médica</h2>
                <p className="text-sm text-slate-500">
                  Descreva a conduta clínica e avalie a intensidade dos sintomas relatados pelo paciente nesta sessão.
                </p>
              </div>

              {sessions.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const last = sessions[sessions.length - 1];
                    setScores({ ...last.scores });
                    toast.success(`Marcadores da consulta anterior (${last.formattedDate}) copiados para o formulário!`);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-200 bg-cyan-50/80 px-3 py-1.5 text-xs font-semibold text-cyan-800 hover:bg-cyan-100 transition-colors shadow-sm"
                  title="Pré-preenche os marcadores com as notas da última consulta para facilitar ajustes rápidos"
                >
                  <Sparkles className="h-3.5 w-3.5 text-cyan-600" />
                  Copiar marcadores da última consulta
                </button>
              )}
            </div>

            <form
              className="mt-5 space-y-5"
              onSubmit={async (event) => {
                event.preventDefault();
                const hasText = Boolean(evolutionText.trim());
                const scoreEntries = Object.entries(scores)
                  .filter(([, val]) => typeof val === "number")
                  .map(([sId, val]) => ({ sintomaId: Number(sId), intensidade: val }));
                const hasScores = scoreEntries.length > 0;

                if (!hasText && !hasScores) {
                  toast.error("Preencha a evolução clínica ou avalie ao menos um sintoma.");
                  return;
                }

                if (hasText && hasScores) {
                  await run(
                    {
                      action: "record_consultation",
                      pacienteId: patient.id,
                      texto: evolutionText.trim(),
                      values: scoreEntries,
                    },
                    "Consulta e evolução registradas com sucesso!"
                  );
                } else if (hasText) {
                  await run(
                    {
                      action: "add_evolution",
                      pacienteId: patient.id,
                      texto: evolutionText.trim(),
                    },
                    "Evolução clínica registrada."
                  );
                } else {
                  await run(
                    {
                      action: "add_symptom_assessment",
                      pacienteId: patient.id,
                      values: scoreEntries,
                    },
                    "Marcadores de sintomas registrados."
                  );
                }

                setEvolutionText("");
                setScores({});
              }}
            >
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Evolução Clínica / Anotação da Sessão
                </label>
                <Textarea
                  value={evolutionText}
                  onChange={(e) => setEvolutionText(e.target.value)}
                  rows={3}
                  placeholder="Ex: Paciente refere redução expressiva das dores musculares após 2ª aplicação. Boa tolerância, sem queixas adversas. Ajustada conduta de manutenção..."
                  className="rounded-xl"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Marcadores de Sintomas do Paciente (Escala 0 a 10)
                  </label>
                  {Object.keys(scores).length > 0 && (
                    <button
                      type="button"
                      onClick={() => setScores({})}
                      className="text-xs text-slate-400 hover:text-slate-600 underline"
                    >
                      Limpar marcadores selecionados
                    </button>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-h-[260px] overflow-y-auto pr-1 p-1">
                  {data.symptoms.map((symptom) => {
                    const currentVal = scores[symptom.id];
                    const hasVal = currentVal !== undefined;
                    const valNumber = hasVal ? currentVal : 0;
                    const badgeClass =
                      valNumber <= 3
                        ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                        : valNumber <= 6
                        ? "text-amber-700 bg-amber-50 border-amber-200"
                        : "text-rose-700 bg-rose-50 border-rose-200";

                    return (
                      <div
                        key={symptom.id}
                        className={`rounded-xl border p-3 transition-all ${
                          hasVal
                            ? "border-cyan-300 bg-cyan-50/20 shadow-sm"
                            : "border-slate-100 bg-slate-50/60 hover:border-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800">{symptom.nome}</span>
                          <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-bold ${hasVal ? badgeClass : "text-slate-400 border-transparent"}`}>
                            {hasVal ? `${valNumber}/10` : "Não avaliado"}
                          </span>
                        </div>
                        <input
                          className="mt-2.5 w-full accent-cyan-700 cursor-pointer"
                          type="range"
                          min="0"
                          max="10"
                          value={hasVal ? currentVal : 0}
                          onChange={(event) =>
                            setScores((current) => ({ ...current, [symptom.id]: Number(event.target.value) }))
                          }
                        />
                        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                          <span>0 (Ausente)</span>
                          <span>5 (Moderado)</span>
                          <span>10 (Máximo)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-500">
                  {Object.keys(scores).length > 0
                    ? `${Object.keys(scores).length} sintomas pontuados`
                    : "Nenhum sintoma selecionado"}
                </span>
                <Button disabled={saving || (!evolutionText.trim() && !Object.keys(scores).length)}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Gravar Consulta e Evolução Clínica
                </Button>
              </div>
            </form>
          </Panel>

          {/* Comprehensive 3-Tab Consultation History & Symptom Auditing */}
          <Panel className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="font-bold text-slate-900 text-lg">Histórico Clínico e Marcadores de Sintomas</h2>
                <p className="text-sm text-slate-500">
                  Acompanhe a evolução detalhada, variação ponto a ponto (deltas) e resposta terapêutica entre consultas.
                </p>
              </div>

              {/* View Switcher Tabs */}
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100/80 p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setHistoryTab("timeline")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
                    historyTab === "timeline"
                      ? "bg-white text-cyan-900 shadow-sm font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <History className="h-3.5 w-3.5 text-cyan-700" />
                  Linha do Tempo
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryTab("matrix")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
                    historyTab === "matrix"
                      ? "bg-white text-cyan-900 shadow-sm font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <TableProperties className="h-3.5 w-3.5 text-cyan-700" />
                  Matriz Comparativa
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryTab("chart")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
                    historyTab === "chart"
                      ? "bg-white text-cyan-900 shadow-sm font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <BarChart2 className="h-3.5 w-3.5 text-cyan-700" />
                  Gráficos Evolutivos
                </button>
              </div>
            </div>

            {/* TAB 1: LINHA DO TEMPO CLÍNICA (CONSULTAS & SESSÕES) */}
            {historyTab === "timeline" && (
              <div className="mt-6 space-y-6">
                {consultationVisits.map((visit) => {
                  const sess = visit.session;
                  const prevSess = visit.previousSession;
                  const sessDelta =
                    sess && prevSess ? sess.totalScore - prevSess.totalScore : null;

                  return (
                    <article
                      key={visit.key}
                      className="rounded-2xl border border-slate-200/80 bg-slate-50/40 p-5 transition-shadow hover:shadow-md"
                    >
                      {/* Consultation Header */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-3">
                          <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-100/70 text-cyan-800 font-bold">
                            <Stethoscope className="h-5 w-5" />
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <strong className="text-sm font-bold text-slate-900">
                                {visit.sessionIndex !== undefined
                                  ? visit.sessionIndex === 0
                                    ? "Consulta Inicial (Baseline)"
                                    : `Consulta #${visit.sessionIndex + 1}`
                                  : "Registro Clínico"}
                              </strong>
                              {visit.evolution && (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                  {visit.evolution.autorNome}
                                </span>
                              )}
                            </div>
                            <time className="text-xs text-slate-400">
                              {visit.formattedDate} {visit.formattedTime ? `às ${visit.formattedTime}` : ""}
                            </time>
                          </div>
                        </div>

                        {/* Session Score & Delta Pill */}
                        {sess && (
                          <div className="flex items-center gap-2">
                            <span className="rounded-xl bg-white border border-slate-200/80 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                              Gravidade Total: <strong className="text-cyan-800">{sess.totalScore} pts</strong>
                            </span>
                            {sessDelta !== null && (
                              <span
                                className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold ${
                                  sessDelta < 0
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                    : sessDelta > 0
                                    ? "bg-rose-100 text-rose-800 border border-rose-200"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {sessDelta < 0 ? (
                                  <>
                                    <TrendingDown className="h-3.5 w-3.5" />
                                    {sessDelta} pts vs anterior
                                  </>
                                ) : sessDelta > 0 ? (
                                  <>
                                    <TrendingUp className="h-3.5 w-3.5" />
                                    +{sessDelta} pts vs anterior
                                  </>
                                ) : (
                                  <>
                                    <Minus className="h-3.5 w-3.5" />
                                    Estável
                                  </>
                                )}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Evolution Narrative Text */}
                      {visit.evolution && (
                        <div className="mt-3 rounded-xl bg-white p-3.5 border border-slate-100 shadow-xs">
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                            Anotação Médica / Conduta
                          </p>
                          <p className="text-sm leading-relaxed text-slate-700">{visit.evolution.texto}</p>
                        </div>
                      )}

                      {/* Symptom Markers Grid for THIS consultation */}
                      {sess && (
                        <div className="mt-4">
                          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                            Marcadores de Sintomas Avaliados Nesta Sessão
                          </span>
                          <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                            {data.symptoms
                              .filter((sym) => sess.scores[sym.id] !== undefined)
                              .map((sym) => {
                                const currentScore = sess.scores[sym.id];
                                const prevScore = prevSess ? prevSess.scores[sym.id] : undefined;
                                const itemDelta = prevScore !== undefined ? currentScore - prevScore : null;

                                const badgeStyle =
                                  currentScore <= 3
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : currentScore <= 6
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-rose-50 text-rose-700 border-rose-200";

                                return (
                                  <div
                                    key={sym.id}
                                    className="rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-xs flex flex-col justify-between"
                                  >
                                    <div className="flex items-center justify-between text-xs mb-1.5">
                                      <span className="font-semibold text-slate-800 truncate" title={sym.nome}>
                                        {sym.nome}
                                      </span>
                                      <span className={`rounded-md border px-1.5 py-0.5 font-bold ${badgeStyle}`}>
                                        {currentScore}/10
                                      </span>
                                    </div>

                                    {/* Visual Bar */}
                                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mb-1.5">
                                      <div
                                        className={`h-full ${
                                          currentScore <= 3
                                            ? "bg-emerald-500"
                                            : currentScore <= 6
                                            ? "bg-amber-500"
                                            : "bg-rose-500"
                                        }`}
                                        style={{ width: `${Math.max(5, currentScore * 10)}%` }}
                                      />
                                    </div>

                                    {/* Delta Indicator */}
                                    <div className="text-[11px] text-slate-500 flex items-center justify-between">
                                      {itemDelta === null ? (
                                        <span className="text-slate-400">Baseline inicial</span>
                                      ) : itemDelta < 0 ? (
                                        <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-600">
                                          <TrendingDown className="h-3 w-3" />
                                          {itemDelta} pts de alívio
                                        </span>
                                      ) : itemDelta > 0 ? (
                                        <span className="inline-flex items-center gap-0.5 font-semibold text-rose-600">
                                          <TrendingUp className="h-3 w-3" />+{itemDelta} pts
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-0.5 text-slate-400">
                                          <Minus className="h-3 w-3" />
                                          Sem alteração
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}

                {!consultationVisits.length && (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center">
                    <Stethoscope className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-2 text-sm font-semibold text-slate-600">Nenhuma consulta registrada para este paciente ainda.</p>
                    <p className="text-xs text-slate-400 mt-1">Utilize o formulário acima para gravar a primeira evolução clínica.</p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: MATRIZ COMPARATIVA DE SINTOMAS (QUADRO CLÍNICO) */}
            {historyTab === "matrix" && (
              <div className="mt-6 overflow-x-auto">
                {sessions.length > 0 ? (
                  <table className="w-full text-left text-xs text-slate-700 border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80">
                        <th className="py-3 px-3 font-bold text-slate-900">Sintoma</th>
                        {sessions.map((sess, idx) => (
                          <th key={sess.id} className="py-3 px-3 font-semibold text-slate-700 whitespace-nowrap text-center">
                            {idx === 0 ? "Baseline" : `C${idx + 1}`}
                            <span className="block font-normal text-[10px] text-slate-400">{sess.formattedDate.slice(0, 5)}</span>
                          </th>
                        ))}
                        {sessions.length > 1 && (
                          <>
                            <th className="py-3 px-3 font-bold text-slate-900 text-center whitespace-nowrap">Variação (Delta)</th>
                            <th className="py-3 px-3 font-bold text-slate-900 text-center">Status Atual</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {symptomsTracked.map((sym) => {
                        const baselineVal = sessions[0].scores[sym.id];
                        const latestVal = sessions[sessions.length - 1].scores[sym.id];
                        const totalDelta =
                          baselineVal !== undefined && latestVal !== undefined
                            ? latestVal - baselineVal
                            : null;

                        return (
                          <tr key={sym.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3 px-3 font-semibold text-slate-900">{sym.nome}</td>
                            {sessions.map((sess) => {
                              const val = sess.scores[sym.id];
                              if (val === undefined) {
                                return (
                                  <td key={sess.id} className="py-3 px-3 text-center text-slate-300">
                                    —
                                  </td>
                                );
                              }
                              const badgeColor =
                                val <= 3
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : val <= 6
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-rose-50 text-rose-700 border-rose-200";

                              return (
                                <td key={sess.id} className="py-3 px-3 text-center">
                                  <span className={`inline-block rounded-md border px-2 py-0.5 font-bold ${badgeColor}`}>
                                    {val}
                                  </span>
                                </td>
                              );
                            })}

                            {sessions.length > 1 && (
                              <>
                                <td className="py-3 px-3 text-center">
                                  {totalDelta === null ? (
                                    <span className="text-slate-300">—</span>
                                  ) : totalDelta < 0 ? (
                                    <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800">
                                      <TrendingDown className="h-3 w-3" />
                                      {totalDelta} pts
                                    </span>
                                  ) : totalDelta > 0 ? (
                                    <span className="inline-flex items-center gap-0.5 rounded-md bg-rose-100 px-2 py-0.5 font-bold text-rose-800">
                                      <TrendingUp className="h-3 w-3" />+{totalDelta} pts
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-0.5 rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                                      <Minus className="h-3 w-3" />
                                      Estável
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-center">
                                  {latestVal !== undefined ? (
                                    latestVal <= 1 ? (
                                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800 text-[11px]">
                                        Remissão
                                      </span>
                                    ) : totalDelta !== null && totalDelta < 0 ? (
                                      <span className="rounded-full bg-cyan-100 px-2 py-0.5 font-semibold text-cyan-800 text-[11px]">
                                        Em Melhora
                                      </span>
                                    ) : totalDelta === 0 ? (
                                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700 text-[11px]">
                                        Estável
                                      </span>
                                    ) : (
                                      <span className="rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-rose-800 text-[11px]">
                                        Atenção
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-slate-300">—</span>
                                  )}
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-900">
                        <td className="py-3 px-3 uppercase tracking-wider text-[11px]">Carga Total (ISS)</td>
                        {sessions.map((sess) => (
                          <td key={sess.id} className="py-3 px-3 text-center text-cyan-800 font-black text-sm">
                            {sess.totalScore}
                          </td>
                        ))}
                        {sessions.length > 1 && (
                          <>
                            <td className="py-3 px-3 text-center">
                              <span
                                className={`font-black text-sm ${
                                  sessions[sessions.length - 1].totalScore < sessions[0].totalScore
                                    ? "text-emerald-600"
                                    : "text-rose-600"
                                }`}
                              >
                                {sessions[sessions.length - 1].totalScore - sessions[0].totalScore} pts
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center text-slate-500 font-normal text-[11px]">
                              {clinicalMetrics.totalReliefPct}% de alívio
                            </td>
                          </>
                        )}
                      </tr>
                    </tfoot>
                  </table>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-500 text-sm">
                    Nenhuma avaliação de sintomas registrada ainda para montar a matriz comparativa.
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: GRÁFICOS EVOLUTIVOS E TENDÊNCIAS (RECHARTS) */}
            {historyTab === "chart" && (
              <div className="mt-6 space-y-6">
                {sessions.length >= 2 ? (
                  <>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                          <TrendingUp className="h-4 w-4 text-cyan-700" />
                          Curva Temporal de Cada Sintoma (Escala 0 a 10)
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {sessions.length} consultas acompanhadas
                        </span>
                      </div>
                      <div className="h-64 w-full text-xs">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="name" stroke="#94a3b8" />
                            <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} stroke="#94a3b8" />
                            <Tooltip />
                            <Legend />
                            {symptomsTracked.map((sym, index) => (
                              <Line
                                key={sym.nome}
                                type="monotone"
                                dataKey={sym.nome}
                                stroke={colors[index % colors.length]}
                                strokeWidth={2.5}
                                dot={{ r: 4 }}
                                activeDot={{ r: 6 }}
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Before vs After Comparison BarChart */}
                    {symptomDeltaComparison.length > 0 && (
                      <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                        <div className="mb-3 flex items-center gap-2 text-xs font-bold text-slate-700">
                          <BarChart2 className="h-4 w-4 text-cyan-700" />
                          Comparativo Direto: Consulta Inicial (Baseline) vs Consulta Atual
                        </div>
                        <div className="h-60 w-full text-xs">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={symptomDeltaComparison} margin={{ top: 10, right: 20, left: -20, bottom: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis dataKey="sintoma" stroke="#94a3b8" angle={-15} textAnchor="end" />
                              <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} stroke="#94a3b8" />
                              <Tooltip />
                              <Legend verticalAlign="top" />
                              <Bar dataKey="Baseline" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="Atual" fill="#0891b2" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </>
                ) : sessions.length === 1 ? (
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                        <BarChart2 className="h-4 w-4 text-cyan-700" />
                        Perfil Inicial de Sintomas do Paciente (Baseline - {sessions[0].formattedDate})
                      </div>
                      <span className="text-xs text-cyan-800 bg-cyan-100/60 rounded-full px-2.5 py-0.5 font-semibold">
                        Primeira Consulta
                      </span>
                    </div>
                    <div className="h-60 w-full text-xs">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={baselineBarData} margin={{ top: 10, right: 20, left: -20, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="sintoma" stroke="#94a3b8" angle={-15} textAnchor="end" />
                          <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} stroke="#94a3b8" />
                          <Tooltip />
                          <Bar dataKey="intensidade" fill="#0891b2" radius={[4, 4, 0, 0]} name="Intensidade (0 a 10)" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-center text-xs text-slate-400 mt-2">
                      Após o registro da próxima consulta, gráficos temporais de tendência e redução serão liberados automaticamente.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-500 text-sm">
                    Nenhum dado para gerar gráficos. Registre a primeira consulta com marcadores de sintomas acima.
                  </div>
                )}
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* Prescriptions of Patient */}
      {doctor && (
        <div className="mt-6">
          <Panel className="p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="font-semibold text-slate-900">Histórico de prescrições deste paciente</h2>
                <p className="mt-1 text-sm text-slate-500">Documentos médicos emitidos para esta pessoa.</p>
              </div>
              <Button size="sm" onClick={onNewRx}>
                <Plus />
                Nova prescrição
              </Button>
            </div>
            {patientPrescriptions.length ? (
              <div className="divide-y divide-slate-100 mt-2">
                {patientPrescriptions.map((rx) => (
                  <div key={rx.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                    <div>
                      <strong className="block text-sm">Prescrição #{String(rx.id).padStart(5, "0")}</strong>
                      <span className="text-xs text-slate-500">{fmtDate(rx.criadoEm)} · {names(rx.items)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Status status={rx.estado} />
                      <Button variant="outline" size="sm" onClick={() => onPrint(rx)}>
                        <Printer className="h-4 w-4" />
                        Imprimir
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-slate-500">Nenhuma prescrição cadastrada para este paciente.</p>
            )}
          </Panel>
        </div>
      )}
    </>
  );
}

function Prescriptions({
  rows,
  doctor,
  onNew,
  onCancel,
  onPrint,
}: {
  rows: Prescription[];
  doctor: boolean;
  onNew: () => void;
  onCancel: (rx: Prescription) => void;
  onPrint: (rx: Prescription) => void;
}) {
  if (!doctor) return <Restricted />;
  return (
    <>
      <PageHeading
        eyebrow="Conduta médica"
        title="Prescrições"
        text="Prescrições médicas com itens múltiplos, vias de administração e rastreabilidade sanitária."
        action={
          <Button onClick={onNew}>
            <Plus />
            Nova prescrição
          </Button>
        }
      />
      <Panel>
        {rows.length ? (
          <div className="divide-y divide-slate-100">
            {rows.map((rx) => (
              <div key={rx.id} className="flex flex-wrap items-center gap-4 p-5">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-50 text-cyan-700">
                  <FileHeart className="h-5 w-5" />
                </span>
                <div className="min-w-[180px] flex-1">
                  <strong className="block">{rx.pacienteNome}</strong>
                  <span className="text-sm text-slate-500">
                    #{String(rx.id).padStart(5, "0")} · {fmtDate(rx.criadoEm)} · Dr(a). {rx.medicoNome}
                    {rx.medicoCrm ? ` (CRM ${rx.medicoCrm}/${rx.medicoCrmUf || ""})` : ""}
                  </span>
                </div>
                <div className="min-w-[200px]">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Itens prescritos</span>
                  <strong className="mt-1 block text-sm">{names(rx.items)}</strong>
                  <span className="mt-1 block text-xs text-slate-500">
                    {rx.items.map((item) => `${item.dose} · ${item.via}`).join("  |  ")}
                  </span>
                </div>
                <Status status={rx.estado} />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => onPrint(rx)}>
                    <Printer className="h-4 w-4" />
                    PDF
                  </Button>
                  {["finalizada", "rascunho"].includes(rx.estado) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-rose-600 hover:bg-rose-50"
                      onClick={() => onCancel(rx)}
                    >
                      <Ban className="h-4 w-4" />
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            icon={FileText}
            title="Nenhuma prescrição emitida"
            text="Crie uma prescrição para um paciente cadastrado."
            action={<Button onClick={onNew}>Criar prescrição</Button>}
          />
        )}
      </Panel>
    </>
  );
}

function pendingItems(rx: Prescription, applications: Application[]) {
  const applied = new Set(
    applications
      .filter((application) => application.prescricaoId === rx.id && !application.estornadaEm)
      .flatMap((application) => application.items.map((item) => item.itemPrescricaoId))
  );
  return rx.items.filter((item) => !applied.has(item.id));
}

function Applications({
  pending,
  applied,
  lots,
  doctor,
  onApply,
  onReverse,
}: {
  pending: Prescription[];
  applied: Application[];
  lots: Lot[];
  doctor: boolean;
  onApply: (rx: Prescription) => void;
  onReverse: (app: Application) => void;
}) {
  if (!doctor) return <Restricted />;
  return (
    <>
      <PageHeading
        eyebrow="Confirmação e rastreabilidade"
        title="Aplicações"
        text="A confirmação física da aplicação vincula o lote e baixa o estoque segundo a regra FEFO."
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel>
          <div className="border-b border-slate-100 px-6 py-5">
            <h2 className="font-semibold text-slate-900">Aguardando aplicação</h2>
            <p className="mt-1 text-xs text-slate-500">Prescrições ativas prontas para realização.</p>
          </div>
          {pending.length ? (
            <div className="divide-y divide-slate-100">
              {pending.map((rx) => {
                const items = pendingItems(rx, applied);
                const available = items.some((item) =>
                  lots.some((lot) => lot.produtoId === item.produtoId && lot.saldo >= item.quantidade && lot.validade >= today())
                );
                return (
                  <div key={rx.id} className="p-5">
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-700">
                        <Syringe className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <strong className="block">{rx.pacienteNome}</strong>
                        <span className="mt-1 block text-sm text-slate-500">{names(items)}</span>
                        <span className="mt-1 block text-xs text-slate-400">{items.length} item(ns) pendente(s)</span>
                      </div>
                      <Status status={rx.estado} />
                    </div>
                    <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
                      <span className="text-xs text-slate-500">
                        {available ? "Lotes válidos disponíveis com saldo" : "Atenção: sem saldo de lote válido"}
                      </span>
                      <Button size="sm" disabled={!available} onClick={() => onApply(rx)}>
                        Confirmar aplicação
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty icon={Check} title="Tudo em dia" text="Não há prescrições aguardando aplicação no momento." />
          )}
        </Panel>

        <Panel>
          <div className="border-b border-slate-100 px-6 py-5">
            <h2 className="font-semibold text-slate-900">Aplicações recentes</h2>
            <p className="mt-1 text-xs text-slate-500">Histórico de ampolas aplicadas com lote e horário.</p>
          </div>
          {applied.length ? (
            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {applied.slice(0, 15).map((application) => (
                <div key={application.id} className="flex items-center justify-between gap-3 p-5">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                        application.estornadaEm ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {application.estornadaEm ? <RotateCcw className="h-5 w-5" /> : <Check className="h-5 w-5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <strong className="block truncate">{application.pacienteNome}</strong>
                        {application.estornadaEm && (
                          <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                            Estornada
                          </span>
                        )}
                      </div>
                      <span className="mt-1 block truncate text-sm text-slate-500">
                        {application.items.map((item) => `${item.produtoNome} · Lote ${item.loteNumero}`).join(" | ")}
                      </span>
                      <time className="block text-xs text-slate-400 mt-0.5">{fmtDateTime(application.aplicadoEm)}</time>
                    </div>
                  </div>

                  {!application.estornadaEm && doctor && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                      onClick={() => onReverse(application)}
                    >
                      Estornar
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Empty icon={History} title="Sem aplicações" text="As aplicações confirmadas aparecerão com lote e horário." />
          )}
        </Panel>
      </div>
    </>
  );
}

function Stock({
  products,
  lots,
  movements,
  doctor,
  onReceive,
  onAdjust,
  onNewProduct,
  run,
  saving,
}: {
  products: (Product & { balance: number })[];
  lots: Lot[];
  movements: StockMovement[];
  doctor: boolean;
  onReceive: () => void;
  onAdjust: () => void;
  onNewProduct: () => void;
  run: (action: Record<string, unknown>, success: string) => Promise<void>;
  saving: boolean;
}) {
  const [tab, setTab] = useState<"balances" | "movements">("balances");

  return (
    <>
      <PageHeading
        eyebrow="Lotes, validade e saldo"
        title="Estoque de injetáveis"
        text="Prioridade sanitária pelo método FEFO (First Expire, First Out)."
        action={
          <>
            {doctor && (
              <>
                <Button variant="outline" onClick={onNewProduct}>
                  <Plus />
                  Novo injetável
                </Button>
                <Button variant="outline" onClick={onAdjust}>
                  <RotateCcw />
                  Ajuste / Descarte
                </Button>
              </>
            )}
            <Button onClick={onReceive}>
              <PackagePlus />
              Registrar entrada
            </Button>
          </>
        }
      />

      {/* Tabs */}
      <div className="mb-6 flex rounded-xl bg-slate-200/70 p-1 w-fit">
        <button
          onClick={() => setTab("balances")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            tab === "balances" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Saldos & Lotes Ativos
        </button>
        <button
          onClick={() => setTab("movements")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            tab === "movements" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Extrato de Movimentações (Kardex)
        </button>
      </div>

      {tab === "balances" ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            const isLow = product.balance <= product.estoqueMinimo;
            return (
              <Panel key={product.id} className="p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-[.14em] text-cyan-700">{product.principioAtivo}</span>
                      <h2 className="mt-1 text-lg font-semibold text-slate-900">{product.nome}</h2>
                      <p className="text-xs text-slate-500">{product.apresentacao} · Unidade: {product.unidade}</p>
                    </div>
                    <span
                      className={`grid min-w-14 place-items-center rounded-xl px-3 py-2 text-xl font-bold ${
                        isLow ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200" : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                      }`}
                    >
                      {product.balance}
                    </span>
                  </div>

                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <div className="mb-2 flex justify-between text-xs text-slate-400">
                      <span>Lotes disponíveis</span>
                      <span>Mínimo: {product.estoqueMinimo}</span>
                    </div>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {lots
                        .filter((lot) => lot.produtoId === product.id && lot.saldo > 0)
                        .map((lot) => {
                          const isExpired = lot.validade < today();
                          return (
                            <div key={lot.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs">
                              <span>
                                Lote <strong>{lot.numero}</strong>
                              </span>
                              <span className={isExpired ? "font-bold text-rose-600" : "text-slate-500"}>
                                {lot.saldo} un · vence {fmtDate(lot.validade)}
                              </span>
                            </div>
                          );
                        })}
                      {!lots.some((lot) => lot.produtoId === product.id && lot.saldo > 0) && (
                        <p className="py-2 text-xs text-slate-400">Nenhum lote com saldo positivo.</p>
                      )}
                    </div>
                  </div>
                </div>

                {doctor && (
                  <div className="mt-4 flex justify-between border-t border-slate-100 pt-3 text-xs">
                    <span className={product.ativo !== false ? "text-emerald-600 font-medium" : "text-slate-400"}>
                      {product.ativo !== false ? "Ativo no catálogo" : "Inativo"}
                    </span>
                    <button
                      disabled={saving}
                      onClick={() =>
                        void run(
                          { action: "toggle_product", id: product.id, ativo: product.ativo === false },
                          product.ativo === false ? "Produto ativado." : "Produto desativado."
                        )
                      }
                      className="font-semibold text-cyan-700 hover:underline"
                    >
                      {product.ativo !== false ? "Desativar" : "Reativar"}
                    </button>
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      ) : (
        <Panel className="p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Extrato de Movimentações de Estoque</h2>
          {movements.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="pb-3 font-semibold">Data/Hora</th>
                    <th className="pb-3 font-semibold">Tipo</th>
                    <th className="pb-3 font-semibold">Injetável</th>
                    <th className="pb-3 font-semibold">Lote</th>
                    <th className="pb-3 font-semibold text-right">Qtd</th>
                    <th className="pb-3 font-semibold">Motivo</th>
                    <th className="pb-3 font-semibold">Responsável</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movements.map((m) => {
                    const isPositive = m.quantidade > 0;
                    return (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="py-3 text-slate-500">{fmtDateTime(m.criadoEm)}</td>
                        <td className="py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 font-bold uppercase tracking-wider text-[10px] ${
                              m.tipo === "entrada"
                                ? "bg-emerald-100 text-emerald-800"
                                : m.tipo === "estorno"
                                ? "bg-purple-100 text-purple-800"
                                : m.tipo === "ajuste"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {m.tipo.replaceAll("_", " ")}
                          </span>
                        </td>
                        <td className="py-3 font-medium text-slate-900">{m.produtoNome}</td>
                        <td className="py-3 text-slate-600">{m.loteNumero}</td>
                        <td className={`py-3 text-right font-bold ${isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                          {isPositive ? `+${m.quantidade}` : m.quantidade}
                        </td>
                        <td className="py-3 text-slate-600 max-w-xs truncate">{m.motivo || "—"}</td>
                        <td className="py-3 text-slate-500">{m.usuarioNome}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">Nenhuma movimentação registrada até o momento.</p>
          )}
        </Panel>
      )}
    </>
  );
}

function Reminders({
  rows,
  run,
  saving,
  onReschedule,
}: {
  rows: Reminder[];
  run: (action: Record<string, unknown>, success: string, close?: () => void) => Promise<void>;
  saving: boolean;
  onReschedule: (rem: Reminder) => void;
}) {
  const [filter, setFilter] = useState<"todos" | "vencidos" | "proximos" | "concluidos">("todos");

  const filtered = rows.filter((item) => {
    const isOverdue = item.dataPrevista < today() && !["concluido", "cancelado"].includes(item.estado);
    if (filter === "vencidos") return isOverdue;
    if (filter === "proximos") return !isOverdue && item.estado === "proximo";
    if (filter === "concluidos") return item.estado === "concluido";
    return true;
  });

  const openWhatsApp = (item: Reminder) => {
    const phone = digits(item.telefone);
    const firstName = item.pacienteNome.split(" ")[0];
    const text = encodeURIComponent(
      `Olá, ${firstName}! Tudo bem? Aqui é da equipe CTI Injetáveis. Lembramos que a sua próxima aplicação de ${
        item.produtoNome ?? "sua terapia injetável"
      } está programada para ${fmtDate(item.dataPrevista)}. Gostaria de confirmar seu horário?`
    );
    window.open(`https://wa.me/55${phone}?text=${text}`, "_blank");
  };

  return (
    <>
      <PageHeading
        eyebrow="Acompanhamento ativo"
        title="Recorrências"
        text="Acompanhe datas de retorno sem expor dados clínicos confidenciais à recepção."
      />

      {/* Filter Tabs */}
      <div className="mb-6 flex flex-wrap rounded-xl bg-slate-200/70 p-1 w-fit">
        <button
          onClick={() => setFilter("todos")}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
            filter === "todos" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Todos ({rows.length})
        </button>
        <button
          onClick={() => setFilter("vencidos")}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
            filter === "vencidos" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Vencidos
        </button>
        <button
          onClick={() => setFilter("proximos")}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
            filter === "proximos" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Próximos
        </button>
        <button
          onClick={() => setFilter("concluidos")}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
            filter === "concluidos" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Concluídos
        </button>
      </div>

      <Panel>
        {filtered.length ? (
          <div className="divide-y divide-slate-100">
            {filtered.map((item) => {
              const isOverdue = item.dataPrevista < today() && item.estado === "proximo";
              return (
                <div key={item.id} className="flex flex-wrap items-center gap-4 p-5">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-50 text-sm font-bold text-cyan-800">
                    {initials(item.pacienteNome)}
                  </span>
                  <div className="min-w-[180px] flex-1">
                    <strong className="block">{item.pacienteNome}</strong>
                    <span className="text-sm text-slate-500">{item.telefone}</span>
                    {item.notaAdministrativa && (
                      <p className="mt-0.5 text-xs text-slate-400 italic">Nota: {item.notaAdministrativa}</p>
                    )}
                  </div>
                  <div className="min-w-[150px]">
                    <span className="text-xs text-slate-400">RETORNO</span>
                    <strong className="mt-1 block text-sm">{item.produtoNome ?? "Acompanhamento"}</strong>
                  </div>
                  <div className="min-w-[112px]">
                    <span className="text-xs text-slate-400">PREVISTO</span>
                    <strong className={`mt-1 block text-sm ${isOverdue ? "text-rose-600 font-bold" : ""}`}>
                      {fmtDate(item.dataPrevista)}
                    </strong>
                  </div>
                  <Status status={isOverdue ? "vencido" : item.estado} />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                      onClick={() => openWhatsApp(item)}
                    >
                      <MessageCircle className="h-4 w-4 text-emerald-600" />
                      WhatsApp
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onReschedule(item)}
                    >
                      Reagendar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={saving || item.estado === "contatado"}
                      onClick={() =>
                        void run(
                          {
                            action: "update_reminder",
                            id: item.id,
                            estado: "contatado",
                            notaAdministrativa: "Contato registrado pela recepção.",
                          },
                          "Contato registrado."
                        )
                      }
                    >
                      Contatado
                    </Button>
                    <Button
                      size="sm"
                      disabled={saving || item.estado === "concluido"}
                      onClick={() =>
                        void run(
                          { action: "update_reminder", id: item.id, estado: "concluido", notaAdministrativa: item.notaAdministrativa },
                          "Recorrência concluída."
                        )
                      }
                    >
                      Concluir
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty
            icon={CalendarClock}
            title="Nenhuma recorrência encontrada"
            text="Aplicações recorrentes criarão o próximo contato automaticamente."
          />
        )}
      </Panel>
    </>
  );
}

function Admin({
  data,
  doctor,
  run,
  saving,
}: {
  data: Payload;
  doctor: boolean;
  run: (action: Record<string, unknown>, success: string, close?: () => void) => Promise<void>;
  saving: boolean;
}) {
  const [auditSearch, setAuditSearch] = useState("");
  if (!doctor) return <Restricted />;

  const filteredAudit = data.audit.filter((row) =>
    `${row.usuarioNome ?? ""} ${row.acao} ${row.entidade} ${row.detalhes}`.toLowerCase().includes(auditSearch.toLowerCase())
  );

  return (
    <>
      <PageHeading
        eyebrow="Configurações clínicas"
        title="Administração"
        text="Gerencie equipe, CRM profissional, catálogo e trilha de auditoria para conformidade médica."
      />
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Symptoms catalog */}
        <Panel className="p-6">
          <h2 className="font-semibold text-slate-900">Catálogo de sintomas clínicos</h2>
          <p className="mt-1 text-xs text-slate-500">Sintomas pontuados de 0 a 10 no prontuário do paciente.</p>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void run(
                { action: "add_symptom", nome: form.get("nome") },
                "Sintoma adicionado.",
                () => (event.currentTarget as HTMLFormElement).reset()
              );
            }}
          >
            <Input name="nome" required placeholder="Ex.: Queda de cabelo, Insônia..." />
            <Button disabled={saving}>Adicionar</Button>
          </form>
          <div className="mt-5 flex flex-wrap gap-2">
            {data.symptoms.map((item) => (
              <span key={item.id} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
                {item.nome}
              </span>
            ))}
          </div>
        </Panel>

        {/* Minimum Stock Configuration */}
        <Panel className="p-6">
          <h2 className="font-semibold text-slate-900">Estoque de segurança (mínimo)</h2>
          <p className="mt-1 text-xs text-slate-500">Alerta emitido quando o saldo atingir este valor.</p>
          <div className="mt-4 space-y-3 max-h-[260px] overflow-y-auto pr-1">
            {data.products.map((product) => (
              <form
                key={product.id}
                className="flex items-center gap-3 rounded-xl bg-slate-50 p-2.5"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void run(
                    {
                      action: "update_product_minimum",
                      id: product.id,
                      estoqueMinimo: Number(form.get("minimum")),
                    },
                    "Estoque mínimo atualizado."
                  );
                }}
              >
                <div className="min-w-0 flex-1">
                  <strong className="block text-sm">{product.nome}</strong>
                  <span className="text-xs text-slate-500">{product.apresentacao}</span>
                </div>
                <Input className="w-20 bg-white" name="minimum" type="number" min="0" defaultValue={product.estoqueMinimo} />
                <Button variant="outline" size="sm" disabled={saving}>
                  Salvar
                </Button>
              </form>
            ))}
          </div>
        </Panel>

        {/* Team & CRM Management */}
        <Panel className="p-6 xl:col-span-2">
          <h2 className="font-semibold text-slate-900">Equipe e CRM médico profissional</h2>
          <p className="mt-1 text-xs text-slate-500">
            Defina papéis de acesso e configure o CRM com UF que sairá impresso nas receitas médicas.
          </p>
          <div className="mt-4 divide-y divide-slate-100">
            {data.users.map((user) => (
              <UserRowCard key={user.id} user={user} run={run} saving={saving} />
            ))}
          </div>
        </Panel>

        {/* Audit Log Table */}
        <Panel className="p-6 xl:col-span-2">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-semibold text-slate-900">Trilha de Auditoria & Conformidade Sanitária</h2>
              <p className="mt-1 text-xs text-slate-500">Registro indelével de todas as ações no sistema.</p>
            </div>
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Filtrar eventos..."
                className="pl-8 h-9 text-xs"
              />
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="pb-2.5 font-semibold">Data/Hora</th>
                  <th className="pb-2.5 font-semibold">Profissional</th>
                  <th className="pb-2.5 font-semibold">Ação</th>
                  <th className="pb-2.5 font-semibold">Entidade</th>
                  <th className="pb-2.5 font-semibold">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAudit.slice(0, 50).map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="py-2.5 text-slate-500">{fmtDateTime(row.criadoEm)}</td>
                    <td className="py-2.5 font-medium text-slate-900">{row.usuarioNome ?? "Sistema"}</td>
                    <td className="py-2.5">
                      <span className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
                        row.acao === "falha_sistema"
                          ? "bg-rose-100 text-rose-800 ring-1 ring-rose-300 font-bold"
                          : row.acao === "estornou"
                          ? "bg-purple-100 text-purple-800 ring-1 ring-purple-200"
                          : row.acao === "atualizou_prontuario"
                          ? "bg-amber-100 text-amber-800 ring-1 ring-amber-200"
                          : row.acao === "ajuste_estoque"
                          ? "bg-orange-100 text-orange-800 ring-1 ring-orange-200"
                          : "bg-slate-100 text-slate-700"
                      }`}>
                        {row.acao}
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-600">
                      {row.entidade} {row.entidadeId ? `#${row.entidadeId}` : ""}
                    </td>
                    <td className="py-2.5 text-slate-600 max-w-md truncate" title={row.detalhes}>
                      {row.detalhes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}

function UserRowCard({
  user,
  run,
  saving,
}: {
  user: UserRow;
  run: (action: Record<string, unknown>, success: string) => Promise<void>;
  saving: boolean;
}) {
  const [crm, setCrm] = useState(user.crm ?? "");
  const [crmUf, setCrmUf] = useState(user.crmUf ?? "CE");

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 py-3.5">
      <div className="flex items-center gap-3 min-w-[220px]">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-50 text-xs font-bold text-cyan-800">
          {initials(user.nome)}
        </span>
        <div>
          <strong className="block text-sm">{user.nome}</strong>
          <span className="text-xs text-slate-500">{user.email}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {user.papel === "medico_admin" && (
          <div className="flex items-center gap-1.5">
            <Input
              value={crm}
              onChange={(e) => setCrm(e.target.value)}
              placeholder="CRM (ex.: 12345)"
              className="w-28 h-9 text-xs"
            />
            <Input
              value={crmUf}
              onChange={(e) => setCrmUf(e.target.value.toUpperCase().slice(0, 2))}
              placeholder="UF"
              className="w-14 h-9 text-xs uppercase"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() =>
                void run(
                  { action: "update_user_profile", id: user.id, crm, crmUf },
                  "CRM médico atualizado."
                )
              }
            >
              Salvar CRM
            </Button>
          </div>
        )}

        <Select
          defaultValue={user.papel}
          onValueChange={(papel) => void run({ action: "update_user_role", id: user.id, papel }, "Perfil de acesso alterado.")}
        >
          <SelectTrigger className="w-44 h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="medico_admin">Médico administrador</SelectItem>
            <SelectItem value="recepcao">Recepção</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function Restricted() {
  return (
    <Panel>
      <Empty icon={ShieldCheck} title="Área clínica restrita" text="Seu perfil de acesso não possui permissão para visualizar este módulo." />
    </Panel>
  );
}

// -------------------------------------------------------------------------------------------------
// Modal Dialogs
// -------------------------------------------------------------------------------------------------

function PatientDialog({
  open,
  setOpen,
  run,
  saving,
}: {
  open: boolean;
  setOpen: (value: boolean) => void;
  run: (action: Record<string, unknown>, success: string, close?: () => void) => Promise<void>;
  saving: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo paciente</DialogTitle>
          <DialogDescription>Cadastre os dados cadastrais do paciente para início de atendimento.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void run(
              {
                action: "create_patient",
                nome: form.get("nome"),
                nascimento: form.get("nascimento"),
                cpf: form.get("cpf"),
                telefone: form.get("telefone"),
                endereco: form.get("endereco"),
                contatoEmergencia: form.get("contatoEmergencia"),
                observacoesAdmin: form.get("observacoesAdmin"),
              },
              "Paciente cadastrado com sucesso.",
              () => setOpen(false)
            );
          }}
        >
          <Field label="Nome completo">
            <Input name="nome" required autoFocus placeholder="Nome do paciente" />
          </Field>
          <Field label="Data de nascimento">
            <Input name="nascimento" type="date" required />
          </Field>
          <Field label="CPF (opcional)">
            <Input name="cpf" inputMode="numeric" placeholder="Apenas números" />
          </Field>
          <Field label="Telefone com DDD">
            <Input name="telefone" required placeholder="(85) 99999-9999" />
          </Field>
          <Field label="Endereço">
            <Input name="endereco" placeholder="Rua, número, bairro..." />
          </Field>
          <Field label="Contato de emergência">
            <Input name="contatoEmergencia" placeholder="Nome e telefone de familiar" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Observações administrativas">
              <Textarea name="observacoesAdmin" rows={2} placeholder="Orientações de contato ou preferências" />
            </Field>
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Salvar paciente
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditPatientDialog({
  patient,
  setPatient,
  run,
  saving,
}: {
  patient: Patient | null;
  setPatient: (value: Patient | null) => void;
  run: (action: Record<string, unknown>, success: string, close?: () => void) => Promise<void>;
  saving: boolean;
}) {
  if (!patient) return null;

  return (
    <Dialog open={!!patient} onOpenChange={(v) => !v && setPatient(null)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar dados do paciente</DialogTitle>
          <DialogDescription>Atualize dados de contato ou endereço de {patient.nome}.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void run(
              {
                action: "update_patient",
                id: patient.id,
                nome: form.get("nome"),
                nascimento: form.get("nascimento"),
                cpf: form.get("cpf"),
                telefone: form.get("telefone"),
                endereco: form.get("endereco"),
                contatoEmergencia: form.get("contatoEmergencia"),
                observacoesAdmin: form.get("observacoesAdmin"),
              },
              "Dados do paciente atualizados.",
              () => setPatient(null)
            );
          }}
        >
          <Field label="Nome completo">
            <Input name="nome" defaultValue={patient.nome} required />
          </Field>
          <Field label="Data de nascimento">
            <Input name="nascimento" type="date" defaultValue={patient.nascimento} required />
          </Field>
          <Field label="CPF">
            <Input name="cpf" defaultValue={patient.cpf ?? ""} placeholder="Apenas números" />
          </Field>
          <Field label="Telefone">
            <Input name="telefone" defaultValue={patient.telefone} required />
          </Field>
          <Field label="Endereço">
            <Input name="endereco" defaultValue={patient.endereco} />
          </Field>
          <Field label="Contato de emergência">
            <Input name="contatoEmergencia" defaultValue={patient.contatoEmergencia} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Observações administrativas">
              <Textarea name="observacoesAdmin" rows={2} defaultValue={patient.observacoesAdmin} />
            </Field>
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setPatient(null)}>
              Cancelar
            </Button>
            <Button disabled={saving}>Salvar alterações</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StockDialog({
  open,
  setOpen,
  products,
  run,
  saving,
}: {
  open: boolean;
  setOpen: (value: boolean) => void;
  products: Product[];
  run: (action: Record<string, unknown>, success: string, close?: () => void) => Promise<void>;
  saving: boolean;
}) {
  const [productId, setProductId] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Entrada de estoque</DialogTitle>
          <DialogDescription>Cadastre o lote e data de validade para controle sanitário.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void run(
              {
                action: "receive_stock",
                produtoId: Number(productId),
                numero: form.get("numero"),
                validade: form.get("validade"),
                quantidade: Number(form.get("quantidade")),
              },
              "Entrada registrada com sucesso.",
              () => setOpen(false)
            );
          }}
        >
          <Field label="Injetável">
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o produto" />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={String(product.id)}>
                    {product.nome} · {product.apresentacao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Número do lote">
              <Input name="numero" required placeholder="Ex.: L-2026-A" />
            </Field>
            <Field label="Validade">
              <Input name="validade" type="date" required />
            </Field>
          </div>
          <Field label="Quantidade recebida (unidades/ampolas)">
            <Input name="quantidade" type="number" min="0.01" step="0.01" required defaultValue="10" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={saving || !productId}>Registrar entrada</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StockAdjustDialog({
  open,
  setOpen,
  products,
  lots,
  run,
  saving,
}: {
  open: boolean;
  setOpen: (value: boolean) => void;
  products: Product[];
  lots: Lot[];
  run: (action: Record<string, unknown>, success: string, close?: () => void) => Promise<void>;
  saving: boolean;
}) {
  const [productId, setProductId] = useState("");
  const [loteId, setLoteId] = useState("");
  const filteredLots = lots.filter((l) => l.produtoId === Number(productId) && l.saldo > 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Baixa de estoque por quebra ou perda</DialogTitle>
          <DialogDescription>
            Registre quebra de ampolas, avarias, vencimentos ou correções com justificativa.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void run(
              {
                action: "adjust_stock",
                produtoId: Number(productId),
                loteId: Number(loteId),
                quantidade: Number(form.get("quantidade")),
                tipoAjuste: form.get("tipoAjuste"),
                motivo: form.get("motivo"),
              },
              "Ajuste de estoque registrado com sucesso.",
              () => setOpen(false)
            );
          }}
        >
          <Field label="Injetável">
            <Select
              value={productId}
              onValueChange={(val) => {
                setProductId(val);
                setLoteId("");
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o produto" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Lote">
            <Select value={loteId} onValueChange={setLoteId} disabled={!productId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o lote a baixar" />
              </SelectTrigger>
              <SelectContent>
                {filteredLots.map((l) => (
                  <SelectItem key={l.id} value={String(l.id)}>
                    Lote {l.numero} · Saldo {l.saldo} un · Vence {fmtDate(l.validade)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Motivo da baixa">
              <Select name="tipoAjuste" defaultValue="quebra">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quebra">Quebra acidental de ampola</SelectItem>
                  <SelectItem value="vencido">Produto vencido/descarte</SelectItem>
                  <SelectItem value="contaminado">Contaminação/avaria de frasco</SelectItem>
                  <SelectItem value="ajuste">Ajuste de inventário físico</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Quantidade a baixar">
              <Input name="quantidade" type="number" min="0.01" step="0.01" required defaultValue="1" />
            </Field>
          </div>

          <Field label="Descrição detalhada do ocorrido">
            <Textarea name="motivo" required rows={2} placeholder="Ex.: Queda do frasco durante manuseio..." />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={saving || !productId || !loteId}>Confirmar baixa</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProductDialog({
  open,
  setOpen,
  run,
  saving,
}: {
  open: boolean;
  setOpen: (value: boolean) => void;
  run: (action: Record<string, unknown>, success: string, close?: () => void) => Promise<void>;
  saving: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo injetável no catálogo</DialogTitle>
          <DialogDescription>Cadastre novo composto para prescrição e controle de estoque.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void run(
              {
                action: "create_product",
                nome: form.get("nome"),
                principioAtivo: form.get("principioAtivo"),
                apresentacao: form.get("apresentacao"),
                unidade: form.get("unidade"),
                estoqueMinimo: Number(form.get("estoqueMinimo")),
              },
              "Injetável adicionado ao catálogo com sucesso.",
              () => setOpen(false)
            );
          }}
        >
          <Field label="Nome comercial / amigável">
            <Input name="nome" required placeholder="Ex.: Glutationa Injetável" />
          </Field>
          <Field label="Princípio ativo">
            <Input name="principioAtivo" required placeholder="Ex.: L-Glutationa Reduzida" />
          </Field>
          <Field label="Apresentação e concentração">
            <Input name="apresentacao" required placeholder="Ex.: 600 mg / 4 mL" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Unidade">
              <Select name="unidade" defaultValue="ampola">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ampola">Ampola</SelectItem>
                  <SelectItem value="frasco">Frasco-ampola</SelectItem>
                  <SelectItem value="seringa">Seringa pré-cheia</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Estoque mínimo de alerta">
              <Input name="estoqueMinimo" type="number" min="0" defaultValue="5" required />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={saving}>Cadastrar produto</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function newDraft(key: string, productId = ""): DraftItem {
  return { key, produtoId: productId, dose: "", via: "IM", quantidade: "1", instrucoes: "", recorrenciaDias: "" };
}

function PrescriptionDialog({
  open,
  setOpen,
  patients,
  products,
  charts,
  run,
  saving,
}: {
  open: boolean;
  setOpen: (value: boolean) => void;
  patients: Patient[];
  products: Product[];
  charts: Chart[];
  run: (action: Record<string, unknown>, success: string, close?: () => void) => Promise<void>;
  saving: boolean;
}) {
  const [patientId, setPatientId] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);

  const handleClose = () => {
    setPatientId("");
    setItems([]);
    setOpen(false);
  };

  const selectedChart = charts.find((c) => c.pacienteId === Number(patientId));

  const update = (key: string, field: keyof Omit<DraftItem, "key">, value: string) =>
    setItems((current) => current.map((item) => (item.key === key ? { ...item, [field]: value } : item)));

  const addItem = (productId = "") => setItems((current) => [...current, newDraft(crypto.randomUUID(), productId)]);

  const addCombo = () => {
    const combo = products.filter((product) => /vitamina\s*(b12|d3)/i.test(product.nome));
    const existing = new Set(items.map((item) => item.produtoId));
    const additions = combo.filter((product) => !existing.has(String(product.id)));
    if (!additions.length) return toast.message("B12 e D3 já constam nos itens prescritos.");
    setItems((current) => [
      ...current,
      ...additions.map((product) => newDraft(crypto.randomUUID(), String(product.id))),
    ]);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) handleClose(); else setOpen(true); }}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova prescrição médica</DialogTitle>
          <DialogDescription>
            Prescreva um ou mais injetáveis com dosagem, via e recorrência individualizadas.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            void run(
              {
                action: "create_prescription",
                pacienteId: Number(patientId),
                itens: items.map((item) => ({
                  produtoId: Number(item.produtoId),
                  dose: item.dose,
                  via: item.via,
                  quantidade: Number(item.quantidade),
                  instrucoes: item.instrucoes,
                  recorrenciaDias: Number(item.recorrenciaDias),
                })),
                observacoes: new FormData(event.currentTarget).get("observacoes"),
              },
              "Prescrição finalizada com sucesso.",
              handleClose
            );
          }}
        >
          <Field label="Paciente">
            <Select value={patientId} onValueChange={setPatientId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o paciente" />
              </SelectTrigger>
              <SelectContent>
                {patients.map((patient) => (
                  <SelectItem key={patient.id} value={String(patient.id)}>
                    {patient.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {/* Allergy alert inside prescription modal */}
          {patientId && (
            <div
              className={`rounded-xl p-3 text-xs flex items-start gap-2 ${
                selectedChart?.alergias
                  ? "border border-amber-300 bg-amber-50 text-amber-900"
                  : "border border-slate-200 bg-slate-50 text-slate-600"
              }`}
            >
              {selectedChart?.alergias ? (
                <>
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <strong>Atenção às alergias cadastradas no prontuário:</strong> {selectedChart.alergias}
                  </div>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                  Nenhuma alergia restritiva informada no prontuário.
                </>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-cyan-100 bg-[#f6fbfd] p-4 sm:p-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h3 className="font-semibold text-slate-900">Itens prescritos</h3>
                <p className="mt-1 text-sm text-slate-500">Cada injetável possui dose, via e posologia próprias.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={addCombo}>
                  Combo B12 + D3
                </Button>
                <Button type="button" size="sm" onClick={() => addItem()}>
                  <Plus />
                  Adicionar injetável
                </Button>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {items.map((item, index) => (
                <div key={item.key} className="relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm font-bold text-cyan-800">Item {index + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remover item"
                      onClick={() => setItems((current) => current.filter((entry) => entry.key !== item.key))}
                    >
                      <Trash2 className="h-4 w-4 text-slate-500 hover:text-rose-600" />
                    </Button>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Injetável">
                      <Select value={item.produtoId} onValueChange={(value) => update(item.key, "produtoId", value)}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((product) => (
                            <SelectItem
                              key={product.id}
                              value={String(product.id)}
                              disabled={items.some(
                                (entry) => entry.key !== item.key && entry.produtoId === String(product.id)
                              )}
                            >
                              {product.nome} · {product.apresentacao}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Dose">
                      <Input
                        value={item.dose}
                        required
                        onChange={(event) => update(item.key, "dose", event.target.value)}
                        placeholder="Ex.: 1 ampola (1 mL)"
                      />
                    </Field>
                    <Field label="Via">
                      <Select value={item.via} onValueChange={(value) => update(item.key, "via", value)}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="IM">Intramuscular (IM)</SelectItem>
                          <SelectItem value="IV">Intravenosa (IV)</SelectItem>
                          <SelectItem value="SC">Subcutânea (SC)</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Quantidade (ampolas)">
                      <Input
                        value={item.quantidade}
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        onChange={(event) => update(item.key, "quantidade", event.target.value)}
                      />
                    </Field>
                    <Field label="Recorrência em dias">
                      <Input
                        value={item.recorrenciaDias}
                        type="number"
                        min="1"
                        placeholder="Ex.: 30 (cria retorno)"
                        onChange={(event) => update(item.key, "recorrenciaDias", event.target.value)}
                      />
                    </Field>
                    <div className="sm:col-span-2 lg:col-span-3">
                      <Field label="Instruções de aplicação">
                        <Textarea
                          value={item.instrucoes}
                          rows={2}
                          onChange={(event) => update(item.key, "instrucoes", event.target.value)}
                          placeholder="Orientações específicas para o profissional aplicador"
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              ))}
              {!items.length && (
                <div className="rounded-xl border border-dashed border-cyan-200 bg-white px-5 py-8 text-center text-sm text-slate-500">
                  Adicione um injetável ou utilize o combo rápido “B12 + D3” para preencher os itens.
                </div>
              )}
            </div>
          </div>

          <Field label="Observações gerais da prescrição">
            <Textarea name="observacoes" rows={2} placeholder="Orientações gerais para o paciente" />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              disabled={
                saving ||
                !patientId ||
                !items.length ||
                items.some((item) => !item.produtoId || !item.dose || !Number(item.quantidade))
              }
            >
              Finalizar prescrição
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CancelPrescriptionDialog({
  rx,
  setRx,
  run,
  saving,
}: {
  rx: Prescription | null;
  setRx: (rx: Prescription | null) => void;
  run: (action: Record<string, unknown>, success: string, close?: () => void) => Promise<void>;
  saving: boolean;
}) {
  if (!rx) return null;
  return (
    <Dialog open={!!rx} onOpenChange={(v) => !v && setRx(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar prescrição #{String(rx.id).padStart(5, "0")}</DialogTitle>
          <DialogDescription>
            Paciente: {rx.pacienteNome}. O cancelamento será registrado na trilha de auditoria.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void run(
              { action: "cancel_prescription", id: rx.id, motivo: form.get("motivo") },
              "Prescrição cancelada com sucesso.",
              () => setRx(null)
            );
          }}
        >
          <Field label="Motivo do cancelamento">
            <Textarea name="motivo" required rows={3} placeholder="Descreva o motivo clínico ou administrativo do cancelamento..." />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRx(null)}>
              Voltar
            </Button>
            <Button variant="destructive" disabled={saving}>
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ApplicationDialog({
  rx,
  setRx,
  lots,
  applications,
  run,
  saving,
}: {
  rx: Prescription | null;
  setRx: (rx: Prescription | null) => void;
  lots: Lot[];
  applications: Application[];
  run: (action: Record<string, unknown>, success: string, close?: () => void) => Promise<void>;
  saving: boolean;
}) {
  if (!rx) return null;
  return (
    <ApplicationDialogInner
      key={rx.id}
      rx={rx}
      setRx={setRx}
      lots={lots}
      applications={applications}
      run={run}
      saving={saving}
    />
  );
}

function ApplicationDialogInner({
  rx,
  setRx,
  lots,
  applications,
  run,
  saving,
}: {
  rx: Prescription;
  setRx: (rx: Prescription | null) => void;
  lots: Lot[];
  applications: Application[];
  run: (action: Record<string, unknown>, success: string, close?: () => void) => Promise<void>;
  saving: boolean;
}) {
  const items = useMemo(() => pendingItems(rx, applications), [rx, applications]);
  const [selected, setSelected] = useState<number[]>(() => items.map((item) => item.id));
  const [lotValues, setLotValues] = useState<Record<number, string>>(() => {
    const nextLots: Record<number, string> = {};
    items.forEach((item) => {
      const lot = lots
        .filter((entry) => entry.produtoId === item.produtoId && entry.saldo >= item.quantidade && entry.validade >= today())
        .sort((a, b) => a.validade.localeCompare(b.validade))[0];
      if (lot) nextLots[item.id] = String(lot.id);
    });
    return nextLots;
  });

  const toggle = (id: number) =>
    setSelected((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));

  return (
    <Dialog open={true} onOpenChange={(value) => !value && setRx(null)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Confirmar aplicação</DialogTitle>
          <DialogDescription>
            {rx ? `${rx.pacienteNome} · Selecione os itens que estão sendo administrados nesta sessão.` : ""}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (!rx) return;
            const form = new FormData(event.currentTarget);
            void run(
              {
                action: "apply_prescription",
                prescricaoId: rx.id,
                itens: items
                  .filter((item) => selected.includes(item.id))
                  .map((item) => ({ itemPrescricaoId: item.id, loteId: Number(lotValues[item.id]) })),
                localAplicacao: form.get("localAplicacao"),
                observacoes: form.get("observacoes"),
                reacao: form.get("reacao"),
              },
              "Aplicação confirmada e estoque baixado.",
              () => setRx(null)
            );
          }}
        >
          <div className="space-y-3">
            {items.map((item) => {
              const validLots = lots
                .filter((lot) => lot.produtoId === item.produtoId && lot.saldo >= item.quantidade && lot.validade >= today())
                .sort((a, b) => a.validade.localeCompare(b.validade));
              const active = selected.includes(item.id);
              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-4 transition ${
                    active ? "border-cyan-300 bg-cyan-50/45" : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex gap-3">
                    <input
                      id={`apply-${item.id}`}
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-cyan-700"
                      checked={active}
                      onChange={() => toggle(item.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <label htmlFor={`apply-${item.id}`} className="cursor-pointer font-semibold">
                        {item.produtoNome}
                      </label>
                      <p className="mt-1 text-sm text-slate-500">
                        {item.dose} · {item.via} · {item.quantidade} unidade(s)
                      </p>
                      {active && (
                        <div className="mt-3">
                          <Field label="Lote sugerido pelo FEFO (validade mais próxima)">
                            <Select
                              value={lotValues[item.id] ?? ""}
                              onValueChange={(value) => setLotValues((current) => ({ ...current, [item.id]: value }))}
                            >
                              <SelectTrigger className="w-full bg-white">
                                <SelectValue placeholder="Selecione o lote" />
                              </SelectTrigger>
                              <SelectContent>
                                {validLots.map((lot, index) => (
                                  <SelectItem key={lot.id} value={String(lot.id)}>
                                    {index === 0 ? "★ Recomendado · " : ""}Lote {lot.numero} · vence {fmtDate(lot.validade)} · saldo {lot.saldo}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                          {!validLots.length && (
                            <p className="mt-2 text-sm font-medium text-rose-600">
                              Não há lote válido com saldo suficiente no estoque.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Local da aplicação">
              <Input name="localAplicacao" required placeholder="Ex.: deltoide direito, glúteo..." />
            </Field>
            <Field label="Reação observada no momento">
              <Input name="reacao" placeholder="Nenhuma ou descreva reação local" />
            </Field>
          </div>

          <Field label="Observações do procedimento">
            <Textarea name="observacoes" rows={2} placeholder="Tolerância da sessão, dor local, etc." />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRx(null)}>
              Cancelar
            </Button>
            <Button disabled={saving || !selected.length || selected.some((id) => !lotValues[id])}>
              <Syringe />
              Confirmar e baixar estoque
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReverseApplicationDialog({
  app,
  setApp,
  run,
  saving,
}: {
  app: Application | null;
  setApp: (app: Application | null) => void;
  run: (action: Record<string, unknown>, success: string, close?: () => void) => Promise<void>;
  saving: boolean;
}) {
  if (!app) return null;

  return (
    <Dialog open={!!app} onOpenChange={(v) => !v && setApp(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Estornar aplicação</DialogTitle>
          <DialogDescription>
            Paciente: {app.pacienteNome}. O estorno devolverá as ampolas ao lote de origem e cancelará o lembrete vinculado.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void run(
              { action: "reverse_application", aplicacaoId: app.id, motivo: form.get("motivo") },
              "Aplicação estornada e estoque devolvido com sucesso.",
              () => setApp(null)
            );
          }}
        >
          <Field label="Motivo do estorno">
            <Textarea
              name="motivo"
              required
              rows={3}
              placeholder="Ex.: Registro efetuado no paciente errado, cancelamento antes da administração..."
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setApp(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={saving}>
              Confirmar estorno
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RescheduleDialog({
  reminder,
  setReminder,
  run,
  saving,
}: {
  reminder: Reminder | null;
  setReminder: (rem: Reminder | null) => void;
  run: (action: Record<string, unknown>, success: string, close?: () => void) => Promise<void>;
  saving: boolean;
}) {
  if (!reminder) return null;

  return (
    <Dialog open={!!reminder} onOpenChange={(v) => !v && setReminder(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reagendar retorno de aplicação</DialogTitle>
          <DialogDescription>
            {reminder.pacienteNome} · {reminder.produtoNome ?? "Aplicação"}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void run(
              {
                action: "update_reminder",
                id: reminder.id,
                dataPrevista: form.get("dataPrevista"),
                estado: "adiado",
                notaAdministrativa: form.get("notaAdministrativa"),
              },
              "Data de retorno atualizada.",
              () => setReminder(null)
            );
          }}
        >
          <Field label="Nova data prevista para o retorno">
            <Input name="dataPrevista" type="date" defaultValue={reminder.dataPrevista} required />
          </Field>
          <Field label="Nota administrativa">
            <Textarea
              name="notaAdministrativa"
              rows={2}
              defaultValue={reminder.notaAdministrativa}
              placeholder="Ex.: Paciente viajou e solicitou adiar para próxima semana..."
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReminder(null)}>
              Cancelar
            </Button>
            <Button disabled={saving}>Salvar nova data</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// -------------------------------------------------------------------------------------------------
// Printable Prescription Sheet
// -------------------------------------------------------------------------------------------------

function PrescriptionPrint({ rx, onClose }: { rx: Prescription; onClose: () => void }) {
  const crmDisplay = rx.medicoCrm ? `CRM ${rx.medicoCrm}/${rx.medicoCrmUf || ""}` : "CRM não configurado";

  return (
    <div className="print-sheet hidden bg-white p-8 text-[#10203b] print:block print:p-0">
      <div className="flex items-center gap-5 border-b-2 border-cyan-700 pb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.jpg" alt="CTI" className="h-16 w-16 object-contain" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#071c42]">CTI — Centro de Terapias Injetáveis</h1>
          <p className="mt-0.5 text-sm font-medium text-slate-600">Prescrição Médica para Aplicação Presencial</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm">
        <PrintInfo label="Paciente" value={rx.pacienteNome} />
        <PrintInfo label="Data de emissão" value={fmtDate(rx.finalizadoEm || rx.criadoEm)} />
        <PrintInfo label="Médico prescritor" value={`Dr(a). ${rx.medicoNome} · ${crmDisplay}`} />
        <PrintInfo label="Número da prescrição" value={`#${String(rx.id).padStart(5, "0")}`} />
      </div>

      <table className="mt-5 w-full border-collapse text-sm">
        <thead>
          <tr className="border-y-2 border-[#071c42] text-left">
            <th className="py-2.5 pr-3 font-semibold text-[#071c42]">Injetável</th>
            <th className="py-2.5 font-semibold text-[#071c42]">Dose</th>
            <th className="py-2.5 font-semibold text-[#071c42]">Via</th>
            <th className="py-2.5 font-semibold text-[#071c42]">Quantidade</th>
            <th className="py-2.5 font-semibold text-[#071c42]">Instruções / Posologia</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rx.items.map((item) => (
            <tr key={item.id} className="align-top">
              <td className="py-3 pr-3">
                <strong className="text-slate-900">{item.produtoNome}</strong>
                <br />
                <span className="text-xs text-slate-500">{item.apresentacao}</span>
              </td>
              <td className="py-3 font-medium text-slate-800">{item.dose}</td>
              <td className="py-3 text-slate-700">{item.via}</td>
              <td className="py-3 font-bold text-slate-900">{item.quantidade}</td>
              <td className="py-3 text-slate-700">{item.instrucoes || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {rx.observacoes && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm">
          <PrintInfo label="Observações médicas" value={rx.observacoes} />
        </div>
      )}

      <div className="mt-14 text-center break-inside-avoid">
        <div className="mx-auto w-80 border-t border-slate-600 pt-2 text-sm">
          <strong className="text-slate-900">Dr(a). {rx.medicoNome}</strong>
          <br />
          <span className="text-xs text-slate-600">{crmDisplay}</span>
        </div>
      </div>

      <p className="mt-8 border-t border-slate-200 pt-3 text-center text-[11px] leading-relaxed text-slate-500 break-inside-avoid">
        Documento médico oficial gerado pelo Sistema CTI Injetáveis para fins de rastreabilidade de enfermagem e aplicação presencial.
      </p>

      <button
        className="print:hidden fixed bottom-6 right-6 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-xl hover:bg-slate-800 transition"
        onClick={onClose}
      >
        Fechar visualização
      </button>
    </div>
  );
}

function PrintInfo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-xs font-bold uppercase tracking-wide text-slate-400">{label}</span>
      <strong className="mt-1 block font-medium text-slate-900">{value}</strong>
    </div>
  );
}
