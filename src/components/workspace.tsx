"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { motion } from "motion/react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  Target,
  Trash2,
  Users,
  WalletCards,
  ChartNoAxesCombined,
  Lightbulb,
  ShieldCheck,
  Pencil,
  Heart,
  Check,
  Copy,
  Mail,
  FolderOpen,
} from "lucide-react";
import { Brand } from "./brand";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { CashChart, SpendingChart } from "./charts";
import { estimatedCompletion } from "@/lib/savings";
import { nextBillDate } from "@/lib/bills";
import { money, percent, split } from "@/lib/finance";
type Wallet = {
  id: string;
  name: string;
  type: string;
  balance: string;
  openingBalance: string;
  householdId: string | null;
  archived: boolean;
};
type Entry = {
  id: string;
  amount: string;
  creatorId: string;
  walletId: string;
  categoryId: string | null;
  wallet: { name: string; householdId: string | null };
  creator: { name: string };
  category: { name: string } | null;
  posting: {
    id: string;
    kind: string;
    description: string;
    notes: string;
    date: string;
    creatorId: string;
  };
};
type Resource = {
  id: string;
  name: string;
  kind: string;
  amount: string;
  date: string;
  category: string;
  householdId: string | null;
  recurrence: string;
  events: {
    id: string;
    amount: string;
    createdAt: string;
    period: string | null;
  }[];
};
type Data = {
  insights?: {
    personal: { code: string; message: string }[];
    shared: { code: string; message: string }[];
  };
  invitations?: {
    id: string;
    email: string;
    status: string;
    expiresAt: string;
  }[];
  wallets: Wallet[];
  entries: Entry[];
  categories: {
    id: string;
    name: string;
    kind: string;
    householdId: string | null;
  }[];
  resources: Resource[];
  notifications: {
    id: string;
    title: string;
    read: boolean;
    createdAt: string;
  }[];
  member: null | {
    role: string;
    householdId: string;
    household: {
      plan?: { amount: string; method: string; firstWeight: string } | null;
      name: string;
      members: {
        userId: string;
        declaredIncome: string;
        user: { id: string; name: string; email: string };
      }[];
    };
  };
};
const empty: Data = {
  wallets: [],
  entries: [],
  categories: [],
  resources: [],
  notifications: [],
  member: null,
};
const navigation = [
  ["dashboard", "Ringkasan", LayoutDashboard],
  ["transactions", "Transaksi", ArrowLeftRight],
  ["wallets", "Dompet", WalletCards],
  ["budgets", "Anggaran", ChartNoAxesCombined],
  ["goals", "Tujuan Tabungan", Target],
  ["bills", "Tagihan Rutin", CalendarDays],
  ["reports", "Laporan", FolderOpen],
  ["household", "Rumah Tangga", Users],
] as const;
const names: Record<string, string> = {
  dashboard: "Ringkasan keuangan",
  transactions: "Transaksi",
  wallets: "Dompet saya",
  budgets: "Anggaran bulanan",
  goals: "Tujuan tabungan",
  bills: "Tagihan rutin",
  reports: "Laporan keuangan",
  household: "Rumah tangga",
  notifications: "Notifikasi",
  settings: "Pengaturan",
  onboarding: "Selamat datang di DuaDompet",
};
const localDate = (date: string) =>
  new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <WalletCards size={34} strokeWidth={1} />
      <p>{text}</p>
      <span className="small">Mulai dengan tombol tambah di atas.</span>
    </div>
  );
}
function Progress({ value }: { value: number }) {
  return (
    <div className="progress">
      <i
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          background: value > 100 ? "var(--red)" : undefined,
        }}
      />
    </div>
  );
}
export function Workspace({
  path,
  user,
  demo,
}: {
  path: string;
  user: { id: string; name: string; email: string };
  demo?: Data;
}) {
  const router = useRouter();
  const [data, setData] = useState<Data>(demo ?? empty),
    [loading, setLoading] = useState(!demo),
    [failed, setFailed] = useState(false),
    [shared, setShared] = useState(false),
    [collapsed, setCollapsed] = useState(false),
    [dark, setDark] = useState(false),
    [dialog, setDialog] = useState(""),
    [requestKey, setRequestKey] = useState(""),
    [busy, setBusy] = useState(false),
    [edit, setEdit] = useState<Record<string, string>>({}),
    [search, setSearch] = useState(""),
    [walletFilter, setWalletFilter] = useState(""),
    [categoryFilter, setCategoryFilter] = useState(""),
    [userFilter, setUserFilter] = useState(""),
    [range, setRange] = useState("month"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [inviteLink, setInviteLink] = useState(""),
    [splitMethod, setSplitMethod] = useState("equal"),
    [splitTotal, setSplitTotal] = useState("5000000"),
    [splitWeight, setSplitWeight] = useState("60"),
    [txKind, setTxKind] = useState("EXPENSE"),
    [selectedWallet, setSelectedWallet] = useState("");
  const root = path.split("/")[0];
  const reload = useCallback(async () => {
    if (demo) return;
    try {
      const r = await fetch("/api/data", { cache: "no-store" });
      if (!r.ok) throw new Error();
      const loaded: Data = await r.json();
      setData(loaded);
      if (loaded.member?.household.plan) {
        const plan = loaded.member.household.plan;
        setSplitTotal(plan.amount);
        setSplitMethod(plan.method);
        setSplitWeight(plan.firstWeight);
      }
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [demo]);
  useEffect(() => {
    void reload();
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker.register("/sw.js");
  }, [reload]);
  useEffect(() => {
    const on = localStorage.getItem("theme") === "dark";
    setDark(on);
    document.body.classList.toggle("dark", on);
  }, []);
  const visibleWallets = data.wallets.filter((w) =>
    shared ? !!w.householdId : !w.householdId,
  );
  const resources = data.resources.filter((r) =>
    shared ? !!r.householdId : !r.householdId,
  );
  const dateBounds = useMemo(() => {
    const now = new Date(today() + "T00:00:00Z");
    let start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    let end = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );
    if (range === "last") {
      start = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
      );
      end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    }
    if (range === "quarter")
      start = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1),
      );
    if (range === "year") {
      start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      end = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1));
    }
    if (range === "custom") {
      start = new Date((from || "2000-01-01") + "T00:00:00Z");
      end = new Date((to || "2100-01-01") + "T00:00:00Z");
      end.setUTCDate(end.getUTCDate() + 1);
    }
    return { start, end };
  }, [range, from, to]);
  const entries = useMemo(
    () =>
      data.entries.filter(
        (e) =>
          (shared ? !!e.wallet.householdId : !e.wallet.householdId) &&
          new Date(e.posting.date) >= dateBounds.start &&
          new Date(e.posting.date) < dateBounds.end &&
          (!walletFilter || e.walletId === walletFilter) &&
          (!categoryFilter || (e.category?.name ?? 'Lainnya') === categoryFilter) &&
          (!userFilter || e.creatorId === userFilter) &&
          `${e.posting.description} ${e.category?.name ?? ""}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [
      data.entries,
      shared,
      dateBounds,
      walletFilter,
      categoryFilter,
      userFilter,
      search,
    ],
  );
  const income = entries
      .filter((e) => e.posting.kind === "INCOME")
      .reduce((s, e) => s + BigInt(e.amount), 0n),
    expense = entries
      .filter((e) => e.posting.kind === "EXPENSE")
      .reduce((s, e) => s - BigInt(e.amount), 0n),
    balance = visibleWallets.reduce((s, w) => s + BigInt(w.balance), 0n);
  const categoryMap = new Map<string, bigint>();
  for (const e of entries.filter((x) => x.posting.kind === "EXPENSE"))
    categoryMap.set(
      e.category?.name ?? "Lainnya",
      (categoryMap.get(e.category?.name ?? "Lainnya") ?? 0n) - BigInt(e.amount),
    );
  const spending = [...categoryMap]
    .map(([name, value]) => ({ name, value: Number(value) }))
    .sort((a, b) => b.value - a.value);
  const interval = Math.max(1, (+dateBounds.end - +dateBounds.start) / 4);
  const chart = Array.from({ length: 4 }, (_, i) => ({
    name: new Date(+dateBounds.start + interval * i).toLocaleDateString(
      "id-ID",
      { day: "numeric", month: "short", timeZone: "Asia/Jakarta" },
    ),
    income: 0,
    expense: 0,
  }));
  for (const e of entries) {
    const index = Math.max(
      0,
      Math.min(
        3,
        Math.floor((+new Date(e.posting.date) - +dateBounds.start) / interval),
      ),
    );
    const point = chart[index];
    if (e.posting.kind === "INCOME") point.income += Number(e.amount);
    if (e.posting.kind === "EXPENSE") point.expense -= Number(e.amount);
  }
  async function mutate(action: string, values: Record<string, unknown>) {
    if (demo) {
      toast.info("Demo hanya baca. Buat akun untuk menyimpan catatan Anda.");
      return null;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...values }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      toast.success("Berhasil disimpan");
      await reload();
      return result;
    } catch (e) {
      toast.error((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  function open(kind: string, values: Record<string, string> = {}) {
    setRequestKey(crypto.randomUUID());
    setEdit(values);
    setTxKind(values.kind ?? "EXPENSE");
    setSelectedWallet(
      values.walletId ?? visibleWallets.find((w) => !w.archived)?.id ?? "",
    );
    setDialog(kind);
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    let result;
    if (dialog === "profile" || dialog === "password") {
      setBusy(true);
      try {
        const r = await fetch("/api/account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: dialog, ...values }),
        });
        if (!r.ok) throw new Error((await r.json()).error);
        toast.success("Berhasil diperbarui");
        result = true;
        if (dialog === "profile") router.refresh();
        if (dialog === "password") void signOut({ callbackUrl: "/login" });
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setBusy(false);
      }
    } else {
      result = await mutate(dialog, {
        ...values,
        shared,
        requestKey,
        id: edit.id,
        withdraw: values.withdraw === "on",
        archived: values.archived === "on",
      });
      if (dialog === "invite" && result?.link) setInviteLink(result.link);
    }
    if (result) setDialog("");
  }
  function exportUrl(format: string) {
    const q = new URLSearchParams({
      format,
      shared: String(shared),
      from: dateBounds.start.toISOString(),
      to: dateBounds.end.toISOString(),
      wallet: walletFilter,
      category: categoryFilter,
      user: userFilter,
      search,
    });
    return "/api/reports?" + q.toString();
  }
  const transactionColumns: ColumnDef<Entry>[] = [
    {
      accessorKey: "posting.description",
      header: "Transaksi",
      cell: ({ row: { original: e } }) => (
        <div className="transaction-name">
          <span className="transaction-icon">
            {BigInt(e.amount) < 0 ? (
              <ArrowUpRight size={16} />
            ) : (
              <ArrowDownLeft size={16} />
            )}
          </span>
          <div>
            <details>
              <summary>{e.posting.description}</summary>
              <p className="small muted">
                {e.posting.notes || "Tanpa catatan tambahan"} · {e.posting.kind}
              </p>
            </details>
            <div className="small muted" style={{ fontWeight: 400 }}>
              {e.creator.name}
            </div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "category.name",
      header: "Kategori",
      cell: ({ row }) => (
        <span className="badge blue">
          {row.original.category?.name ??
            {
              TRANSFER: "Transfer",
              CONTRIBUTION: "Kontribusi",
              ADJUSTMENT: "Penyesuaian",
            }[row.original.posting.kind] ??
            "Lainnya"}
        </span>
      ),
    },
    {
      accessorKey: "posting.date",
      header: "Tanggal",
      cell: ({ row }) => localDate(row.original.posting.date),
    },
    { accessorKey: "wallet.name", header: "Dompet" },
    {
      accessorKey: "amount",
      header: "Nominal",
      sortingFn: (a, b) =>
        BigInt(a.original.amount) > BigInt(b.original.amount) ? 1 : -1,
      cell: ({ row }) => (
        <strong className={BigInt(row.original.amount) < 0 ? "red" : "green"}>
          {BigInt(row.original.amount) > 0 ? "+" : ""}
          {money(row.original.amount)}
        </strong>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row: { original: e } }) =>
        e.posting.creatorId === user.id && (
          <div className="toolbar">
            <button
              aria-label="Edit transaksi"
              className="btn ghost"
              onClick={() => {
                const paired = data.entries.filter(
                  (x) => x.posting.id === e.posting.id,
                );
                const source = paired.find((x) => BigInt(x.amount) < 0) ?? e;
                const destination = paired.find((x) => BigInt(x.amount) > 0);
                open("posting", {
                  id: e.posting.id,
                  kind: e.posting.kind,
                  description: e.posting.description,
                  notes: e.posting.notes,
                  amount: (BigInt(e.amount) < 0
                    ? -BigInt(e.amount)
                    : BigInt(e.amount)
                  ).toString(),
                  walletId: source.walletId,
                  destinationId: destination?.walletId ?? "",
                  categoryId: source.categoryId ?? "",
                  date: e.posting.date.slice(0, 10),
                });
              }}
            >
              <Pencil size={13} />
            </button>
            <button
              aria-label="Hapus transaksi"
              className="btn ghost"
              onClick={() => open("deletePosting", { id: e.posting.id })}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ),
    },
  ];
  const table = useReactTable({
    data: entries,
    columns: transactionColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });
  function transactionTable(short = false) {
    return (
      <>
        <div className="table-wrap">
          <table className="transactions-table">
            <thead>
              {table.getHeaderGroups().map((h) => (
                <tr key={h.id}>
                  {h.headers
                    .filter((c) => !short || c.column.id !== "actions")
                    .map((c) => (
                      <th key={c.id}>
                        <button
                          className="ghost"
                          style={{ border: 0, padding: 0 }}
                          onClick={c.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            c.column.columnDef.header,
                            c.getContext(),
                          )}
                          {c.column.getIsSorted() ? " ↕" : ""}
                        </button>
                      </th>
                    ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {(short
                ? table.getRowModel().rows.slice(0, 5)
                : table.getRowModel().rows
              ).map((row) => (
                <tr key={row.id}>
                  {row
                    .getVisibleCells()
                    .filter((c) => !short || c.column.id !== "actions")
                    .map((cell) => (
                      <td key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!entries.length && (
          <Empty text="Belum ada transaksi dalam periode ini." />
        )}
        {!short && (
          <div className="pagination">
            <Button
              variant="outline"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              <ChevronLeft size={15} />
            </Button>
            <span className="small muted">
              Halaman {table.getState().pagination.pageIndex + 1} dari{" "}
              {Math.max(1, table.getPageCount())}
            </span>
            <Button
              variant="outline"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              <ChevronRight size={15} />
            </Button>
          </div>
        )}
      </>
    );
  }
  function budgetUsage(r: Resource) {
    return data.entries
      .filter(
        (e) =>
          (shared ? !!e.wallet.householdId : !e.wallet.householdId) &&
          e.posting.kind === "EXPENSE" &&
          (e.category?.name ?? "Lainnya") === r.category &&
          e.posting.date.slice(0, 7) === r.date.slice(0, 7),
      )
      .reduce((s, e) => s - BigInt(e.amount), 0n);
  }
  function goalList() {
    return resources
      .filter((r) => r.kind === "GOAL")
      .slice(0, 3)
      .map((r) => {
        const funded = r.events.reduce((s, e) => s + BigInt(e.amount), 0n);
        const progress = percent(funded, BigInt(r.amount));
        return (
          <div className="goal-item" key={r.id}>
            <div className="goal-head">
              <span className="goal-icon">
                <Target size={17} />
              </span>
              <div>
                <h3>{r.name}</h3>
                <span className="muted small">
                  Target{" "}
                  {localDate(
                    r.kind === "BILL"
                      ? nextBillDate(
                          r.date,
                          r.recurrence,
                          r.events.map((e) => e.period),
                        ).toISOString()
                      : r.date,
                  )}
                </span>
              </div>
              <strong className="small">{progress}%</strong>
            </div>
            <Progress value={progress} />
            <div className="goal-values">
              <span>{money(funded)}</span>
              <span>dari {money(r.amount)}</span>
            </div>
          </div>
        );
      });
  }
  const periodSelect = (
    <>
      <select
        aria-label="Periode"
        value={range}
        onChange={(e) => setRange(e.target.value)}
        style={{ width: 160, fontSize: 12 }}
      >
        <option value="month">Bulan ini</option>
        <option value="last">Bulan lalu</option>
        <option value="quarter">3 bulan terakhir</option>
        <option value="year">Tahun ini</option>
        <option value="custom">Rentang khusus</option>
      </select>
      {range === "custom" && (
        <>
          <input
            type="date"
            aria-label="Dari tanggal"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            style={{ width: 150 }}
          />
          <input
            type="date"
            aria-label="Sampai tanggal"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={{ width: 150 }}
          />
        </>
      )}
    </>
  );
  return (
    <div className={collapsed ? "collapsed" : ""}>
      <aside className="sidebar" id="desktop-sidebar">
        <Link href="/" aria-label="DuaDompet, beranda">
          <Brand />
        </Link>
        <div className="space-picker">
          <span className="avatar">
            <Users size={18} />
          </span>
          <div>
            <span className="small muted">Ruang keuangan</span>
            <select
              aria-label="Ruang keuangan"
              value={shared ? "shared" : "personal"}
              onChange={(e) => setShared(e.target.value === "shared")}
            >
              <option value="personal">Pribadi</option>
              {data.member && (
                <option value="shared">{data.member.household.name}</option>
              )}
            </select>
          </div>
        </div>
        <span className="eyebrow" style={{ paddingLeft: 14 }}>
          MENU UTAMA
        </span>
        <nav className="nav-group">
          {navigation.map(([url, title, Icon]) => (
            <Link
              href={demo ? "/demo" : `/${url}`}
              key={url}
              aria-label={title}
              className={`nav-link ${root === url ? "active" : ""}`}
            >
              <Icon size={18} />
              <span className="label">{title}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="invite-box">
            <Heart size={21} color="#6b75da" />
            <h3 style={{ marginTop: 9, fontSize: 12 }}>Lebih baik bersama</h3>
            <p className="small muted" style={{ marginTop: 5 }}>
              Bangun masa depan finansial bersama pasangan.
            </p>
            <Link href="/household" className="btn outline">
              Undang pasangan <ArrowUpRight size={13} />
            </Link>
          </div>
          <Link
            className={`nav-link ${root === "settings" ? "active" : ""}`}
            aria-label="Pengaturan"
            href="/settings"
          >
            <Settings size={18} />
            <span className="label">Pengaturan</span>
          </Link>
          <button
            className="nav-link"
            aria-label="Keluar"
            style={{ width: "100%", border: 0, background: "transparent" }}
            onClick={() => void signOut({ callbackUrl: "/" })}
          >
            <LogOut size={18} />
            <span className="label">Keluar</span>
          </button>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="toolbar">
            <button
              className="btn ghost hide-mobile"
              aria-label={collapsed ? 'Buka sidebar' : 'Ringkas sidebar'}
              aria-controls="desktop-sidebar"
              aria-expanded={!collapsed}
              onClick={() => setCollapsed(!collapsed)}
            >
              <Menu size={19} />
            </button>
            <span className="hide-mobile muted small">
              Ruang keuangan <span style={{ margin: "0 10px" }}> / </span>
            </span>
            <strong className="small">{names[root] ?? "DuaDompet"}</strong>
          </div>
          <div className="topbar-right">
            <button
              className="btn ghost"
              aria-label="Ganti tema"
              onClick={() => {
                setDark(!dark);
                document.body.classList.toggle("dark", !dark);
                localStorage.setItem("theme", !dark ? "dark" : "light");
              }}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Link
              aria-label="Notifikasi"
              href="/notifications"
              style={{ position: "relative" }}
            >
              <Bell size={19} />
              {data.notifications.some((n) => !n.read) && (
                <i
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 0,
                    background: "#ed6475",
                    width: 6,
                    height: 6,
                    borderRadius: 5,
                  }}
                />
              )}
            </Link>
            <div className="vertical" />
            <div className="avatar">{user.name.slice(0, 1)}</div>
            <div className="hide-mobile">
              <strong className="small">{user.name}</strong>
              <div className="muted" style={{ fontSize: 10 }}>
                {shared ? "Rumah tangga" : "Akun pribadi"}
              </div>
            </div>
          </div>
        </header>
        <motion.main
          key={path}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="content"
        >
          {demo && (
            <div className="notice">
              MODE DEMO · Data ilustrasi, hanya baca.{" "}
              <Link href="/register">
                <strong>Buat akun untuk mulai →</strong>
              </Link>
            </div>
          )}
          {failed && (
            <div className="error" role="alert">
              Data belum dapat dimuat. Periksa koneksi database.{" "}
              <button onClick={() => void reload()}>Coba kembali</button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <h1>
                {root === "dashboard"
                  ? `Halo, ${user.name.split(" ")[0]} 👋`
                  : (names[root] ?? "Undangan pasangan")}
              </h1>
              <p>
                {root === "dashboard"
                  ? "Mari lihat kabar keuanganmu hari ini. Setiap langkah kecil berarti."
                  : "Dua dompet, satu tujuan. Kelola dengan lebih terarah."}
              </p>
            </div>
            <div className="toolbar">
              {["dashboard", "transactions", "reports"].includes(root) &&
                periodSelect}
              {root === "dashboard" || root === "transactions" ? (
                <Button disabled={loading} onClick={() => open("posting")}>
                  <Plus size={16} />
                  Tambah Transaksi
                </Button>
              ) : ["wallets", "budgets", "goals", "bills"].includes(root) ? (
                <Button
                  disabled={loading}
                  onClick={() =>
                    open(root === "wallets" ? "wallet" : "resource", {
                      kind:
                        root === "budgets"
                          ? "BUDGET"
                          : root === "goals"
                            ? "GOAL"
                            : "BILL",
                    })
                  }
                >
                  <Plus size={16} />
                  Tambah{" "}
                  {root === "wallets"
                    ? "Dompet"
                    : root === "budgets"
                      ? "Anggaran"
                      : root === "goals"
                        ? "Tujuan"
                        : "Tagihan"}
                </Button>
              ) : null}
            </div>
          </div>
          <div className="toolbar" style={{ marginBottom: 20 }}>
            <button
              className={`btn ${!shared ? "primary" : "outline"}`}
              disabled={loading}
              onClick={() => setShared(false)}
            >
              Pribadi
            </button>
            <button
              className={`btn ${shared ? "primary" : "outline"}`}
              disabled={loading}
              onClick={() =>
                data.member ? setShared(true) : open("household")
              }
            >
              <Users size={14} />
              Bersama
            </button>
          </div>
          {loading ? (
            <>
              <div className="stats">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="skeleton" />
                ))}
              </div>
              <div className="skeleton" style={{ height: 350 }} />
            </>
          ) : (
            <>
              {root === "dashboard" && (
                <>
                  {!data.wallets.length && (
                    <div className="insight">
                      <Lightbulb color="#4f6de8" />
                      <div>
                        <h3>Awali perjalanan keuanganmu</h3>
                        <p className="muted small">
                          Buat dompet pertama, lalu catat pemasukan atau
                          pengeluaran.
                        </p>
                        <Button
                          style={{ marginTop: 12 }}
                          onClick={() => open("wallet")}
                        >
                          Buat dompet pertama
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="stats">
                    {[
                      [
                        "Total saldo tercatat",
                        balance,
                        WalletCards,
                        "Seluruh dompet pada ruang ini",
                      ],
                      [
                        "Pemasukan",
                        income,
                        ArrowDownLeft,
                        "Pemasukan dalam periode terpilih",
                      ],
                      [
                        "Pengeluaran",
                        expense,
                        ArrowUpRight,
                        "Pengeluaran dalam periode terpilih",
                      ],
                      [
                        "Arus kas bersih",
                        income - expense,
                        Target,
                        "Pemasukan dikurangi pengeluaran",
                      ],
                    ].map(([label, value, Icon, sub]) => {
                      const I = Icon as typeof WalletCards;
                      return (
                        <article className="card stat" key={String(label)}>
                          <div className="stat-label">
                            <span>{String(label)}</span>
                            <span className="stat-icon">
                              <I size={17} />
                            </span>
                          </div>
                          <strong>{money(value as bigint)}</strong>
                          <span className="muted" style={{ fontSize: 10 }}>
                            {String(sub)}
                          </span>
                        </article>
                      );
                    })}
                  </div>
                  <div className="two-col">
                    <section className="card">
                      <div className="card-title">
                        <div>
                          <h2>Arus kas</h2>
                          <p className="muted small" style={{ marginTop: 4 }}>
                            Pemasukan dan pengeluaran yang tercatat
                          </p>
                        </div>
                        <div className="legend">
                          <span>
                            <i
                              className="dot"
                              style={{ background: "#5276f5" }}
                            />
                            Masuk
                          </span>
                          <span>
                            <i
                              className="dot"
                              style={{ background: "#65ccb2" }}
                            />
                            Keluar
                          </span>
                        </div>
                      </div>
                      <CashChart data={chart} />
                    </section>
                    <section className="card">
                      <div className="card-title">
                        <h2>Pengeluaran per kategori</h2>
                        <span className="muted">•••</span>
                      </div>
                      <SpendingChart
                        data={spending}
                        total={expense.toString()}
                      />
                    </section>
                  </div>
                  <div className="two-col">
                    <section className="card">
                      <div className="card-title">
                        <h2>Transaksi terbaru</h2>
                        <Link
                          href="/transactions"
                          className="small"
                          style={{ color: "var(--blue)" }}
                        >
                          Lihat semua →
                        </Link>
                      </div>
                      {transactionTable(true)}
                    </section>
                    <section className="card">
                      <div className="card-title">
                        <h2>Impian kita</h2>
                        <Link href="/goals" style={{ color: "var(--blue)" }}>
                          <Plus size={18} />
                        </Link>
                      </div>
                      {resources.some((r) => r.kind === "GOAL") ? (
                        goalList()
                      ) : (
                        <Empty text="Impian besar dimulai dari satu tujuan." />
                      )}
                    </section>
                  </div>
                  <div className="two-col">
                    <section className="card">
                      <div className="card-title">
                        <h2>Anggaran bulan ini</h2>
                        <Link href="/budgets" className="small green">
                          Kelola →
                        </Link>
                      </div>
                      {resources
                        .filter(
                          (r) =>
                            r.kind === "BUDGET" &&
                            r.date.slice(0, 7) === today().slice(0, 7),
                        )
                        .map((r) => (
                          <div className="goal-item" key={r.id}>
                            <div className="category-row">
                              <strong>{r.name}</strong>
                              <span>
                                {money(budgetUsage(r))} / {money(r.amount)}
                              </span>
                            </div>
                            <Progress
                              value={percent(budgetUsage(r), BigInt(r.amount))}
                            />
                          </div>
                        ))}
                      {!resources.some((r) => r.kind === "BUDGET") && (
                        <Empty text="Belum ada anggaran." />
                      )}
                    </section>
                    <section className="card">
                      <div className="card-title">
                        <h2>Tagihan mendatang</h2>
                        <Link href="/bills" className="small green">
                          Lihat semua →
                        </Link>
                      </div>
                      {resources
                        .filter((r) => r.kind === "BILL")
                        .slice(0, 3)
                        .map((r) => (
                          <div className="category-row" key={r.id}>
                            <span>
                              {r.name}
                              <div className="muted">
                                {localDate(
                                  r.kind === "BILL"
                                    ? nextBillDate(
                                        r.date,
                                        r.recurrence,
                                        r.events.map((e) => e.period),
                                      ).toISOString()
                                    : r.date,
                                )}
                              </div>
                            </span>
                            <strong>{money(r.amount)}</strong>
                          </div>
                        ))}
                      {!resources.some((r) => r.kind === "BILL") && (
                        <Empty text="Tidak ada tagihan tercatat." />
                      )}
                    </section>
                  </div>
                  <div className="insight">
                    <Lightbulb color="#5276f5" size={23} />
                    <div>
                      <h3>Insight bulan ini</h3>
                      {data.insights?.[shared ? "shared" : "personal"].map(
                        (insight) => (
                          <p
                            key={insight.code + insight.message}
                            className="small muted"
                            style={{ marginTop: 6 }}
                          >
                            {insight.message}
                          </p>
                        ),
                      )}
                      <p className="muted small" style={{ marginTop: 5 }}>
                        {expense > income && expense > 0n
                          ? "Pengeluaran melebihi pemasukan pada periode ini. Tinjau kategori pengeluaran untuk memahami perubahannya."
                          : income > 0n
                            ? `Arus kas bersih Anda ${money(income - expense)} pada periode ini.`
                            : "Catat transaksi untuk mulai memahami pola keuangan Anda."}{" "}
                        {resources.some(
                          (r) =>
                            r.kind === "BUDGET" &&
                            percent(budgetUsage(r), BigInt(r.amount)) >= 80,
                        )
                          ? "Ada anggaran yang telah terpakai 80% atau lebih."
                          : ""}
                      </p>
                      <span className="small muted">
                        Informasi otomatis, bukan nasihat keuangan profesional.
                      </span>
                    </div>
                  </div>
                  <p className="small muted" style={{ marginTop: 18 }}>
                    Saldo merupakan catatan manual, bukan saldo bank yang
                    diverifikasi. Alokasi tujuan tidak menambah atau memindahkan
                    uang.
                  </p>
                </>
              )}
              {root === "transactions" && (
                <section className="card">
                  <div className="toolbar" style={{ marginBottom: 20 }}>
                    <div style={{ position: "relative" }}>
                      <Search
                        size={16}
                        style={{
                          position: "absolute",
                          left: 12,
                          top: 13,
                          color: "var(--muted)",
                        }}
                      />
                      <input
                        className="search"
                        style={{ paddingLeft: 35 }}
                        placeholder="Cari transaksi…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <select
                      style={{ width: 170 }}
                      aria-label="Filter dompet"
                      value={walletFilter}
                      onChange={(e) => setWalletFilter(e.target.value)}
                    >
                      <option value="">Semua dompet</option>
                      {visibleWallets.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                    <select
                      style={{ width: 160 }}
                      aria-label="Filter kategori"
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                      <option value="">Semua kategori</option>
                      {[...new Set(data.categories.map((c) => c.name))].map(
                        (c) => (
                          <option key={c}>{c}</option>
                        ),
                      )}
                    </select>
                    <select
                      style={{ width: 160 }}
                      aria-label="Filter anggota"
                      value={userFilter}
                      onChange={(e) => setUserFilter(e.target.value)}
                    >
                      <option value="">Semua pencatat</option>
                      {[
                        ...new Map(
                          data.entries.map((e) => [
                            e.creatorId,
                            e.creator.name,
                          ]),
                        ).entries(),
                      ].map(([id, name]) => (
                        <option value={id} key={id}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <a className="btn outline" href={exportUrl("csv")} download="duadompet-laporan.csv">
                      <Download size={15} />
                      CSV
                    </a>
                  </div>
                  {transactionTable()}
                </section>
              )}
              {root === "wallets" && (
                <>
                  <div className="wallet-grid">
                    {visibleWallets.map((w) => (
                      <article className="card wallet-card" key={w.id}>
                        <div className="card-title">
                          <WalletCards size={26} />
                          <span className="small">
                            {w.householdId ? "BERSAMA" : "PRIBADI"} · {w.type}
                          </span>
                        </div>
                        <div>
                          <h2>
                            {w.name} {w.archived ? "(Diarsipkan)" : ""}
                          </h2>
                          <strong>{money(w.balance)}</strong>
                        </div>
                        <div className="category-row">
                          <span>Saldo tercatat · IDR</span>
                          <button
                            aria-label="Edit dompet"
                            onClick={() =>
                              open("walletUpdate", {
                                id: w.id,
                                name: w.name,
                                archived: String(w.archived),
                              })
                            }
                            style={{
                              border: 0,
                              background: "transparent",
                              color: "white",
                            }}
                          >
                            <Pencil size={16} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                  {!visibleWallets.length && (
                    <Empty text="Belum ada dompet. Buat dompet pertamamu." />
                  )}
                  <p className="muted small" style={{ marginTop: 25 }}>
                    Saldo awal + seluruh transaksi tercatat. DuaDompet tidak
                    terhubung ke bank.
                  </p>
                  <Button
                    variant="outline"
                    style={{ marginTop: 20 }}
                    onClick={() => open("category")}
                  >
                    Tambah kategori khusus
                  </Button>
                </>
              )}
              {["budgets", "goals", "bills"].includes(root) && (
                <>
                  <div className="resource-grid">
                    {resources
                      .filter(
                        (r) =>
                          r.kind ===
                          (root === "budgets"
                            ? "BUDGET"
                            : root === "goals"
                              ? "GOAL"
                              : "BILL"),
                      )
                      .map((r) => {
                        const funded = r.events.reduce(
                          (s, e) => s + BigInt(e.amount),
                          0n,
                        );
                        const used =
                          root === "budgets" ? budgetUsage(r) : funded;
                        const p = percent(used, BigInt(r.amount));
                        return (
                          <article className="card" key={r.id}>
                            <div className="card-title">
                              <span
                                className="feature-icon"
                                style={{ margin: 0 }}
                              >
                                {root === "goals" ? (
                                  <Target size={20} />
                                ) : root === "bills" ? (
                                  <CalendarDays size={20} />
                                ) : (
                                  <ChartNoAxesCombined size={20} />
                                )}
                              </span>
                              <button
                                aria-label="Edit"
                                className="btn ghost"
                                onClick={() =>
                                  open("resourceUpdate", {
                                    id: r.id,
                                    name: r.name,
                                    amount: r.amount,
                                    date: r.date.slice(0, 10),
                                  })
                                }
                              >
                                <Pencil size={14} />
                              </button>
                            </div>
                            <h2>{r.name}</h2>
                            <p className="muted small">
                              {r.category} ·{" "}
                              {localDate(
                                r.kind === "BILL"
                                  ? nextBillDate(
                                      r.date,
                                      r.recurrence,
                                      r.events.map((e) => e.period),
                                    ).toISOString()
                                  : r.date,
                              )}
                            </p>
                            <h1 style={{ fontSize: 25, marginTop: 18 }}>
                              {money(r.amount)}
                            </h1>
                            {root !== "bills" && (
                              <>
                                <Progress value={p} />
                                <div className="goal-values">
                                  <span>
                                    {root === "goals"
                                      ? "Dialokasikan"
                                      : "Terpakai"}{" "}
                                    {money(used)}
                                  </span>
                                  <strong className={p > 100 ? "red" : "green"}>
                                    {p}%
                                  </strong>
                                </div>
                                <p
                                  className="muted small"
                                  style={{ marginTop: 12 }}
                                >
                                  Sisa{" "}
                                  {money(
                                    BigInt(r.amount) > used
                                      ? BigInt(r.amount) - used
                                      : 0n,
                                  )}
                                  {p >= 100
                                    ? root === "goals"
                                      ? " · Tercapai"
                                      : " · Melewati anggaran"
                                    : ""}
                                </p>
                              </>
                            )}
                            {root === "goals" && (
                              <p
                                className="muted small"
                                style={{ marginTop: 12 }}
                              >
                                Estimasi:{" "}
                                {estimatedCompletion(r.events, r.amount)
                                  ? localDate(
                                      estimatedCompletion(r.events, r.amount)!,
                                    )
                                  : "Perlu riwayat alokasi minimal 7 hari"}
                                . Berdasarkan pola alokasi tercatat.
                              </p>
                            )}
                            {root === "goals" && (
                              <Button
                                variant="outline"
                                style={{ marginTop: 20, width: "100%" }}
                                onClick={() => open("fund", { id: r.id })}
                              >
                                <Plus size={14} />
                                Catat alokasi / penarikan
                              </Button>
                            )}
                            {root === "bills" && (
                              <>
                                <p
                                  className="muted small"
                                  style={{ marginTop: 12 }}
                                >
                                  Pengulangan{" "}
                                  {r.recurrence === "YEARLY"
                                    ? "tahunan"
                                    : "bulanan"}{" "}
                                  · {r.events.length} pembayaran
                                </p>
                                <Button
                                  style={{ marginTop: 18, width: "100%" }}
                                  onClick={() =>
                                    open("pay", { id: r.id, amount: r.amount })
                                  }
                                >
                                  <Check size={14} />
                                  Konfirmasi pembayaran
                                </Button>
                              </>
                            )}
                            {r.events.length > 0 && (
                              <details style={{ marginTop: 18 }}>
                                <summary className="small muted">
                                  Riwayat ({r.events.length})
                                </summary>
                                {r.events.map((e) => (
                                  <div className="category-row" key={e.id}>
                                    <span>
                                      {e.period ?? localDate(e.createdAt)}
                                    </span>
                                    <span>{money(e.amount)}</span>
                                  </div>
                                ))}
                              </details>
                            )}
                          </article>
                        );
                      })}
                  </div>
                  {!resources.some(
                    (r) =>
                      r.kind ===
                      (root === "budgets"
                        ? "BUDGET"
                        : root === "goals"
                          ? "GOAL"
                          : "BILL"),
                  ) && <Empty text="Belum ada catatan pada ruang ini." />}
                  {root === "goals" && (
                    <p className="muted small" style={{ marginTop: 20 }}>
                      Alokasi tujuan adalah penandaan dana tabungan yang telah
                      Anda sisihkan. Gunakan transfer dompet jika uang
                      dipindahkan. Alokasi tidak dihitung sebagai pemasukan.
                    </p>
                  )}
                </>
              )}
              {root === "reports" && (
                <>
                  <div className="toolbar" style={{ marginBottom: 20 }}>
                    <a className="btn primary" href={exportUrl("csv")} download="duadompet-laporan.csv">
                      <Download size={15} />
                      Unduh CSV
                    </a>
                    <a className="btn outline" href={exportUrl("pdf")} download="duadompet-laporan.pdf">
                      <Download size={15} />
                      Unduh PDF
                    </a>
                  </div>
                  <div className="report-grid">
                    <div className="card">
                      <h2>Ringkasan periode</h2>
                      {[
                        ["Pemasukan", income],
                        ["Pengeluaran", expense],
                        ["Arus kas", income - expense],
                        ["Saldo seluruh waktu", balance],
                      ].map(([n, v]) => (
                        <div className="category-row" key={String(n)}>
                          <span>{String(n)}</span>
                          <strong>{money(v as bigint)}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="card">
                      <h2>Saldo dompet</h2>
                      {visibleWallets.map((w) => (
                        <div className="category-row" key={w.id}>
                          <span>{w.name}</span>
                          <strong>{money(w.balance)}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="card">
                      <h2>Pengeluaran menurut kategori</h2>
                      <SpendingChart
                        data={spending}
                        total={expense.toString()}
                      />
                    </div>
                    <div className="card">
                      <h2>Progres tujuan</h2>
                      <div style={{ marginTop: 20 }}>{goalList()}</div>
                      <h2 style={{ marginTop: 30 }}>Kinerja anggaran</h2>
                      {resources
                        .filter((r) => r.kind === "BUDGET")
                        .map((r) => (
                          <div className="category-row" key={r.id}>
                            <span>{r.name}</span>
                            <strong>
                              {percent(budgetUsage(r), BigInt(r.amount))}%
                            </strong>
                          </div>
                        ))}
                    </div>
                  </div>
                </>
              )}
              {root === "household" && (
                <>
                  {data.member && (
                    <div className="stats">
                      {[
                        [
                          "Saldo bersama",
                          data.wallets
                            .filter((w) => w.householdId)
                            .reduce((s, w) => s + BigInt(w.balance), 0n),
                        ],
                        [
                          "Kontribusi tercatat",
                          data.entries
                            .filter(
                              (e) =>
                                e.wallet.householdId &&
                                e.posting.kind === "CONTRIBUTION",
                            )
                            .reduce((s, e) => s + BigInt(e.amount), 0n),
                        ],
                        [
                          "Pengeluaran bersama",
                          data.entries
                            .filter(
                              (e) =>
                                e.wallet.householdId &&
                                e.posting.kind === "EXPENSE",
                            )
                            .reduce((s, e) => s - BigInt(e.amount), 0n),
                        ],
                        [
                          "Alokasi tujuan bersama",
                          data.resources
                            .filter((r) => r.householdId && r.kind === "GOAL")
                            .flatMap((r) => r.events)
                            .reduce((s, e) => s + BigInt(e.amount), 0n),
                        ],
                      ].map(([label, value]) => (
                        <article className="card stat" key={String(label)}>
                          <div className="stat-label">{String(label)}</div>
                          <strong>{money(value as bigint)}</strong>
                          <span className="small muted">
                            Seluruh waktu · catatan manual
                          </span>
                        </article>
                      ))}
                    </div>
                  )}
                  {path.includes("invitations") && (
                    <div className="card" style={{ marginBottom: 20 }}>
                      <h2>Undangan rumah tangga</h2>
                      <p className="muted">
                        Terima hanya undangan dari pasangan yang Anda kenal.
                        Email akun harus sama dengan email yang diundang.
                      </p>
                      <div className="toolbar" style={{ marginTop: 20 }}>
                        <Button
                          onClick={() =>
                            void mutate("accept", {
                              token: new URLSearchParams(location.search).get(
                                "token",
                              ),
                            })
                          }
                        >
                          Terima undangan
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            void mutate("reject", {
                              token: new URLSearchParams(location.search).get(
                                "token",
                              ),
                            })
                          }
                        >
                          Tolak
                        </Button>
                      </div>
                    </div>
                  )}
                  {!data.member ? (
                    <div className="card empty">
                      <Users size={44} />
                      <h2>Rencanakan hidup bersama.</h2>
                      <p>Buat rumah tangga dan undang satu pasangan dewasa.</p>
                      <Button onClick={() => open("household")}>
                        <Plus size={16} />
                        Buat rumah tangga
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="two-col">
                        <section className="card">
                          <div className="card-title">
                            <h2>{data.member.household.name}</h2>
                            <span className="badge blue">
                              {data.member.household.members.length}/2 anggota
                            </span>
                          </div>
                          {data.member.household.members.map((m) => (
                            <div
                              className="goal-head"
                              style={{ marginTop: 18 }}
                              key={m.userId}
                            >
                              <span className="avatar">{m.user.name[0]}</span>
                              <div>
                                <h3>{m.user.name}</h3>
                                <p className="small muted">{m.user.email}</p>
                              </div>
                              <span className="badge blue">
                                {m.userId === user.id ? "Anda" : "Pasangan"}
                              </span>
                            </div>
                          ))}
                          {data.member.role === "OWNER" && (
                            <Button
                              variant="outline"
                              style={{ marginTop: 25 }}
                              onClick={() => open("invite")}
                            >
                              <Mail size={15} />
                              Undang pasangan
                            </Button>
                          )}
                          {inviteLink && (
                            <div
                              className="insight"
                              style={{ display: "block" }}
                            >
                              <p className="small">
                                Tautan berlaku 3 hari. Kirimkan kepada pasangan.
                              </p>
                              <input readOnly value={inviteLink} />
                              <Button
                                variant="outline"
                                onClick={() => {
                                  void navigator.clipboard.writeText(
                                    inviteLink,
                                  );
                                  toast.success("Tautan disalin");
                                }}
                              >
                                <Copy size={14} />
                                Salin
                              </Button>
                            </div>
                          )}
                          {data.invitations?.map((inv) => (
                            <div className="category-row" key={inv.id}>
                              <span>
                                {inv.email}
                                <br />
                                <span className="muted">
                                  {new Date(inv.expiresAt) < new Date()
                                    ? "EXPIRED"
                                    : inv.status}
                                </span>
                              </span>
                              {inv.status === "PENDING" && (
                                <Button
                                  variant="outline"
                                  onClick={() =>
                                    void mutate("revoke", { id: inv.id })
                                  }
                                >
                                  Cabut
                                </Button>
                              )}
                            </div>
                          ))}
                          <Button
                            variant="outline"
                            style={{ marginTop: 15 }}
                            onClick={() => open("declaredIncome")}
                          >
                            Atur pendapatan deklarasi
                          </Button>
                        </section>
                        <section className="card">
                          <h2>Pembagian kontribusi</h2>
                          <label>
                            Rencana kebutuhan bersama
                            <input
                              inputMode="numeric"
                              value={splitTotal}
                              onChange={(e) => setSplitTotal(e.target.value)}
                            />
                          </label>
                          <label>
                            Metode
                            <select
                              value={splitMethod}
                              onChange={(e) => setSplitMethod(e.target.value)}
                            >
                              <option value="equal">50 / 50</option>
                              <option value="percentage">
                                Persentase khusus
                              </option>
                              <option value="fixed">
                                Nominal tetap anggota pertama
                              </option>
                              <option value="income">
                                Proporsional pendapatan deklarasi
                              </option>
                            </select>
                          </label>
                          {["percentage", "fixed"].includes(splitMethod) && (
                            <label>
                              {splitMethod === "fixed"
                                ? "Nominal anggota pertama"
                                : "Persen anggota pertama"}
                              <input
                                value={splitWeight}
                                onChange={(e) => setSplitWeight(e.target.value)}
                              />
                            </label>
                          )}
                          {(() => {
                            try {
                              const members = data.member.household.members;
                              const total = BigInt(splitTotal);
                              let weights = members.map(() => 1n);
                              if (splitMethod === "income")
                                weights = members.map((m) =>
                                  BigInt(m.declaredIncome),
                                );
                              if (splitMethod === "percentage") {
                                const w = BigInt(splitWeight);
                                weights = [w, 100n - w].slice(
                                  0,
                                  members.length,
                                );
                              }
                              if (splitMethod === "fixed") {
                                const w = BigInt(splitWeight);
                                weights = [w, total - w].slice(
                                  0,
                                  members.length,
                                );
                              }
                              const expected = split(total, weights);
                              return members.map((m, i) => {
                                const actual = data.entries
                                  .filter(
                                    (e) =>
                                      e.creatorId === m.userId &&
                                      e.posting.kind === "CONTRIBUTION" &&
                                      !!e.wallet.householdId &&
                                      new Date(e.posting.date) >=
                                        dateBounds.start &&
                                      new Date(e.posting.date) < dateBounds.end,
                                  )
                                  .reduce((s, e) => s + BigInt(e.amount), 0n);
                                return (
                                  <div className="goal-item" key={m.userId}>
                                    <h3>{m.user.name}</h3>
                                    <div className="category-row">
                                      <span>Rencana</span>
                                      <strong>{money(expected[i])}</strong>
                                    </div>
                                    <div className="category-row">
                                      <span>Aktual periode ini</span>
                                      <strong className="green">
                                        {money(actual)}
                                      </strong>
                                    </div>
                                    <div className="category-row">
                                      <span>Sisa kontribusi</span>
                                      <strong>
                                        {money(
                                          expected[i] > actual
                                            ? expected[i] - actual
                                            : 0n,
                                        )}
                                      </strong>
                                    </div>
                                  </div>
                                );
                              });
                            } catch {
                              return (
                                <p className="muted small">
                                  Masukkan nominal dan bobot yang valid.
                                  Pendapatan deklarasi harus lebih dari nol
                                  untuk metode proporsional.
                                </p>
                              );
                            }
                          })()}
                          <p className="muted small" style={{ marginTop: 20 }}>
                            Rencana kontribusi. Hanya transaksi kontribusi yang
                            dihitung sebagai realisasi; transfer tidak menambah
                            pemasukan rumah tangga.
                          </p>
                          <Button
                            style={{ marginTop: 15 }}
                            disabled={busy}
                            onClick={() =>
                              void mutate("savePlan", {
                                amount: splitTotal,
                                method: splitMethod,
                                firstWeight: splitWeight,
                              })
                            }
                          >
                            Simpan rencana kontribusi
                          </Button>
                        </section>
                      </div>
                      <div className="card">
                        <h2>Privasi tetap milik Anda</h2>
                        <p className="muted" style={{ marginTop: 10 }}>
                          Hanya dompet bersama yang dapat dilihat anggota rumah
                          tangga. Pilih ruang “Bersama” untuk melihat transaksi,
                          anggaran, dan tujuan bersama.
                        </p>
                      </div>
                    </>
                  )}
                </>
              )}
              {root === "notifications" && (
                <section className="card">
                  <div className="card-title">
                    <h2>Kabar keuangan Anda</h2>
                    <Button
                      variant="outline"
                      onClick={() => void mutate("readNotifications", {})}
                    >
                      Tandai semua dibaca
                    </Button>
                  </div>
                  {data.notifications.map((n) => (
                    <article className="goal-item" key={n.id}>
                      <div className="card-title">
                        <h3>
                          {!n.read && (
                            <i
                              className="dot"
                              style={{ background: "var(--blue)" }}
                            />
                          )}
                          {n.title}
                        </h3>
                        <span className="small muted">
                          {localDate(n.createdAt)}
                        </span>
                      </div>
                    </article>
                  ))}
                  {!data.notifications.length && (
                    <Empty text="Belum ada notifikasi." />
                  )}
                </section>
              )}
              {root === "settings" && (
                <>
                  <div className="toolbar" style={{ marginBottom: 20 }}>
                    {navigation.map(([url, title]) => (
                      <Link className="btn outline" href={"/" + url} key={url}>
                        {title}
                      </Link>
                    ))}
                  </div>
                  <div className="report-grid">
                    <section className="card">
                      <div className="card-title">
                        <h2>Profil</h2>
                        <ShieldCheck color="var(--green)" />
                      </div>
                      <p>{user.name}</p>
                      <p className="muted">{user.email}</p>
                      <Button
                        variant="outline"
                        style={{ marginTop: 20 }}
                        onClick={() => open("profile", { name: user.name })}
                      >
                        Edit profil
                      </Button>
                    </section>
                    <section className="card">
                      <h2>Keamanan akun</h2>
                      <p className="muted small" style={{ margin: "12px 0" }}>
                        Perubahan kata sandi mengakhiri seluruh sesi aktif.
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => open("password")}
                      >
                        Ganti kata sandi
                      </Button>
                    </section>
                    <section className="card">
                      <h2>Preferensi notifikasi</h2>
                      <div className="toolbar" style={{ marginTop: 20 }}>
                        <Button
                          variant="outline"
                          onClick={() =>
                            void mutate("preferences", { enabled: true })
                          }
                        >
                          Aktifkan
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            void mutate("preferences", { enabled: false })
                          }
                        >
                          Nonaktifkan
                        </Button>
                      </div>
                    </section>
                    <section className="card">
                      <h2>Kategori</h2>
                      <p className="muted small" style={{ margin: "12px 0" }}>
                        Kategori pribadi dan bersama dipisahkan.
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => open("category")}
                      >
                        Tambah kategori
                      </Button>
                    </section>
                    <section className="card">
                      <h2>Sesi akun</h2>
                      <Button
                        variant="outline"
                        style={{ marginTop: 20 }}
                        onClick={() => void signOut({ callbackUrl: "/" })}
                      >
                        <LogOut size={15} />
                        Keluar
                      </Button>
                    </section>
                  </div>
                </>
              )}
              {root === "onboarding" && (
                <section
                  className="card"
                  style={{ maxWidth: 650, margin: "auto" }}
                >
                  <span className="feature-icon">
                    <Heart />
                  </span>
                  <h1>Dua Dompet, Satu Tujuan.</h1>
                  <p className="muted" style={{ marginTop: 15 }}>
                    Mulai dengan dompet pribadi. Kategori Indonesia sudah
                    disiapkan. Anda dapat mengundang pasangan kapan saja.
                  </p>
                  <div className="toolbar" style={{ marginTop: 30 }}>
                    <Button onClick={() => open("wallet")}>
                      Buat dompet pertama
                    </Button>
                    <Button variant="outline" onClick={() => open("household")}>
                      Pilih mode pasangan
                    </Button>
                    <Link href="/dashboard" className="btn ghost">
                      Lanjut ke dashboard →
                    </Link>
                  </div>
                </section>
              )}
            </>
          )}
        </motion.main>
      </div>
      <nav className="mobile-nav">
        {navigation
          .filter(([p]) =>
            [
              "dashboard",
              "transactions",
              "wallets",
              "goals",
              "household",
            ].includes(p),
          )
          .map(([url, title, Icon]) => (
            <Link
              key={url}
              href={demo ? "/demo" : "/" + url}
              className={root === url ? "active" : ""}
            >
              <Icon size={20} />
              {title}
            </Link>
          ))}
        <Link href="/settings">
          <Settings size={20} />
          Lainnya
        </Link>
      </nav>
      <Dialog
        open={!!dialog}
        onOpenChange={(o) => !o && setDialog("")}
        title={
          (
            {
              posting: edit.id ? "Edit transaksi" : "Tambah transaksi",
              wallet: "Dompet baru",
              walletUpdate: "Edit dompet",
              resource: "Rencana baru",
              resourceUpdate: "Edit rencana",
              household: "Buat rumah tangga",
              invite: "Undang pasangan",
              fund: "Alokasi tujuan",
              pay: "Konfirmasi pembayaran",
              category: "Kategori baru",
              profile: "Edit profil",
              password: "Ganti kata sandi",
              declaredIncome: "Pendapatan deklarasi",
              deletePosting: "Hapus transaksi?",
            } as Record<string, string>
          )[dialog] ?? "Catatan"
        }
      >
        <form method="post" onSubmit={submit}>
          {dialog === "posting" && (
            <>
              <label>
                Jenis transaksi
                <select
                  name="kind"
                  value={txKind}
                  onChange={(e) => setTxKind(e.target.value)}
                >
                  {[
                    ["EXPENSE", "Pengeluaran"],
                    ["INCOME", "Pemasukan"],
                    ["TRANSFER", "Transfer"],
                    ["CONTRIBUTION", "Kontribusi"],
                    ["ADJUSTMENT", "Penyesuaian tambah saldo"],
                  ].map(([v, l]) => (
                    <option value={v} key={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Deskripsi
                <input
                  name="description"
                  required
                  maxLength={180}
                  defaultValue={edit.description}
                />
              </label>
              <div className="form-grid">
                <label>
                  Nominal (Rp)
                  <input
                    name="amount"
                    inputMode="numeric"
                    pattern="[1-9][0-9]{0,14}"
                    required
                    defaultValue={edit.amount}
                  />
                </label>
                <label>
                  Tanggal
                  <input
                    type="date"
                    name="date"
                    required
                    defaultValue={edit.date ?? today()}
                  />
                </label>
              </div>
              <label>
                Dompet sumber
                <select
                  name="walletId"
                  required
                  value={selectedWallet}
                  onChange={(e) => setSelectedWallet(e.target.value)}
                >
                  <option value="">Pilih dompet</option>
                  {data.wallets
                    .filter((w) => !w.archived)
                    .map((w) => (
                      <option value={w.id} key={w.id}>
                        {w.name} {w.householdId ? "(Bersama)" : "(Pribadi)"}
                      </option>
                    ))}
                </select>
              </label>
              {["TRANSFER", "CONTRIBUTION"].includes(txKind) ? (
                <label>
                  Dompet tujuan
                  <select
                    required
                    name="destinationId"
                    defaultValue={edit.destinationId ?? ""}
                  >
                    <option value="">Pilih tujuan</option>
                    {data.wallets
                      .filter((w) => !w.archived && w.id !== selectedWallet)
                      .map((w) => (
                        <option value={w.id} key={w.id}>
                          {w.name}
                        </option>
                      ))}
                  </select>
                </label>
              ) : (
                <label>
                  Kategori
                  <select
                    name="categoryId"
                    defaultValue={edit.categoryId ?? ""}
                  >
                    <option value="">Tanpa kategori</option>
                    {data.categories
                      .filter(
                        (c) =>
                          c.householdId ===
                            (data.wallets.find((w) => w.id === selectedWallet)
                              ?.householdId ?? null) &&
                          (txKind === "ADJUSTMENT" || c.kind === txKind),
                      )
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <label>
                Catatan
                <textarea
                  name="notes"
                  maxLength={2000}
                  defaultValue={edit.notes}
                />
              </label>
            </>
          )}
          {dialog === "wallet" && (
            <>
              <label>
                Nama dompet
                <input
                  required
                  name="name"
                  placeholder="Rekening utama"
                  maxLength={80}
                />
              </label>
              <label>
                Jenis
                <select name="type">
                  <option value="BANK">Rekening bank</option>
                  <option value="CASH">Tunai</option>
                  <option value="EWALLET">E-wallet</option>
                  <option value="SAVINGS">Tabungan</option>
                </select>
              </label>
              <label>
                Saldo awal (Rp)
                <input
                  name="openingBalance"
                  inputMode="numeric"
                  pattern="[0-9]{1,15}"
                  required
                  defaultValue="0"
                />
              </label>
              <p className="muted small">
                Visibilitas: {shared ? "bersama rumah tangga" : "pribadi"}.
                Saldo dicatat manual.
              </p>
            </>
          )}
          {dialog === "walletUpdate" && (
            <>
              <label>
                Nama dompet
                <input name="name" required defaultValue={edit.name} />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  name="archived"
                  defaultChecked={edit.archived === "true"}
                />
                Arsipkan dompet (riwayat tetap tersimpan)
              </label>
            </>
          )}
          {dialog === "category" && (
            <>
              <label>
                Nama kategori
                <input required name="name" maxLength={80} />
              </label>
              <label>
                Jenis
                <select name="kind">
                  <option value="EXPENSE">Pengeluaran</option>
                  <option value="INCOME">Pemasukan</option>
                </select>
              </label>
            </>
          )}
          {dialog === "resource" && (
            <>
              <input type="hidden" name="kind" value={edit.kind} />
              <label>
                Nama
                <input required name="name" maxLength={100} />
              </label>
              <label>
                Nominal target (Rp)
                <input
                  name="amount"
                  inputMode="numeric"
                  pattern="[1-9][0-9]{0,14}"
                  required
                />
              </label>
              <label>
                {edit.kind === "BUDGET"
                  ? "Bulan anggaran (pilih tanggal dalam bulan)"
                  : "Tanggal target / jatuh tempo"}
                <input
                  type="date"
                  name="date"
                  defaultValue={today()}
                  required
                />
              </label>
              <label>
                Kategori
                <select name="category">
                  {[
                    ...new Set(
                      data.categories
                        .filter((c) => c.kind === "EXPENSE")
                        .map((c) => c.name),
                    ),
                  ].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              {edit.kind === "BILL" && (
                <label>
                  Pengulangan
                  <select name="recurrence">
                    <option value="MONTHLY">Bulanan</option>
                    <option value="YEARLY">Tahunan</option>
                  </select>
                </label>
              )}
            </>
          )}
          {dialog === "resourceUpdate" && (
            <>
              <label>
                Nama
                <input name="name" required defaultValue={edit.name} />
              </label>
              <label>
                Nominal target
                <input
                  name="amount"
                  required
                  pattern="[1-9][0-9]{0,14}"
                  defaultValue={edit.amount}
                />
              </label>
              <label>
                Tanggal
                <input
                  type="date"
                  name="date"
                  required
                  defaultValue={edit.date}
                />
              </label>
            </>
          )}
          {(dialog === "household" || dialog === "profile") && (
            <label>
              {dialog === "household" ? "Nama rumah tangga" : "Nama lengkap"}
              <input
                name="name"
                defaultValue={edit.name}
                minLength={2}
                maxLength={80}
                required
              />
            </label>
          )}
          {dialog === "invite" && (
            <label>
              Email pasangan
              <input type="email" name="email" required />
            </label>
          )}
          {["fund", "pay", "declaredIncome"].includes(dialog) && (
            <label>
              Nominal (Rp)
              <input
                name="amount"
                inputMode="numeric"
                pattern={
                  dialog === "declaredIncome"
                    ? "[0-9]{1,15}"
                    : "[1-9][0-9]{0,14}"
                }
                defaultValue={edit.amount}
                required
              />
            </label>
          )}
          {dialog === "fund" && (
            <>
              <label className="check">
                <input type="checkbox" name="withdraw" />
                Penarikan alokasi
              </label>
              <p className="muted small">
                Catat dana yang telah Anda sisihkan. Ini tidak memindahkan uang
                atau mengubah saldo dompet.
              </p>
            </>
          )}
          {dialog === "pay" && (
            <>
              <label>
                Periode pembayaran
                <input
                  type="month"
                  name="period"
                  defaultValue={today().slice(0, 7)}
                  required
                />
              </label>
              <label>
                Dompet pembayaran
                <select name="walletId" required>
                  {visibleWallets
                    .filter((w) => !w.archived)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                </select>
              </label>
              <p className="muted small">
                Konfirmasi membuat satu transaksi pengeluaran. Satu pembayaran
                per tagihan per periode.
              </p>
            </>
          )}
          {dialog === "password" && (
            <>
              <label>
                Kata sandi saat ini
                <input
                  name="currentPassword"
                  type="password"
                  required
                  autoComplete="current-password"
                />
              </label>
              <label>
                Kata sandi baru
                <input
                  name="password"
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                />
              </label>
              <p className="muted small">
                Minimal 12 karakter, huruf besar, kecil, dan angka.
              </p>
            </>
          )}
          {dialog === "deletePosting" && (
            <p style={{ marginTop: 20 }}>
              Transaksi dan seluruh pasangan transfer akan dihapus. Saldo akan
              dihitung ulang.
            </p>
          )}
          <div className="form-footer">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialog("")}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant={dialog === "deletePosting" ? "destructive" : "default"}
              disabled={busy}
            >
              {busy
                ? "Menyimpan…"
                : dialog === "deletePosting"
                  ? "Hapus transaksi"
                  : "Simpan"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
