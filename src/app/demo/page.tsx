import { Workspace } from "@/components/workspace";
export default function Page() {
  const month = new Date().toISOString().slice(0, 7);
  const user = {
    id: "demo",
    name: "Nadia Putri",
    email: "demo@example.invalid",
  };
  const records = [
    ["Gaji bulanan", "Gaji", "11000000", "INCOME", 2],
    ["Belanja kebutuhan rumah", "Belanja Bulanan", "-1250000", "EXPENSE", 4],
    ["Makan malam berdua", "Makanan", "-185000", "EXPENSE", 6],
    ["Internet rumah", "Internet", "-350000", "EXPENSE", 8],
    ["Bensin & transportasi", "Transportasi", "-420000", "EXPENSE", 10],
    ["Belanja mingguan", "Makanan", "-650000", "EXPENSE", 14],
    ["Proyek desain", "Freelance", "2000000", "INCOME", 17],
    ["Kebutuhan rumah", "Rumah Tangga", "-480000", "EXPENSE", 20],
  ] as const;
  const entries = records.map(([description, name, amount, kind, day], i) => ({
    id: "demo-" + i,
    amount,
    creatorId: "demo",
    walletId: "demo-wallet",
    categoryId: null,
    wallet: { name: "Rekening utama", householdId: null },
    creator: { name: user.name },
    category: { name },
    posting: {
      id: "demo-post-" + i,
      kind,
      description,
      notes: "Data ilustrasi demo",
      date: `${month}-${String(day).padStart(2, "0")}T05:00:00Z`,
      creatorId: "demo",
    },
  }));
  return (
    <Workspace
      path="dashboard"
      user={user}
      demo={{
        wallets: [
          {
            id: "demo-wallet",
            name: "Rekening utama",
            type: "BANK",
            balance: entries
              .reduce((s, e) => s + BigInt(e.amount), 5000000n)
              .toString(),
            openingBalance: "5000000",
            householdId: null,
            archived: false,
          },
        ],
        entries,
        categories: [],
        notifications: [],
        member: null,
        resources: [
          {
            id: "demo-goal",
            kind: "GOAL",
            name: "DP rumah pertama",
            amount: "150000000",
            date: "2028-12-01",
            category: "Lainnya",
            householdId: null,
            recurrence: "MONTHLY",
            events: [
              {
                id: "demo-event",
                amount: "45000000",
                createdAt: new Date().toISOString(),
                period: null,
              },
            ],
          },
          {
            id: "demo-budget",
            kind: "BUDGET",
            name: "Makan & belanja",
            amount: "2500000",
            date: month + "-01",
            category: "Makanan",
            householdId: null,
            recurrence: "MONTHLY",
            events: [],
          },
          {
            id: "demo-bill",
            kind: "BILL",
            name: "Internet rumah",
            amount: "350000",
            date: month + "-25",
            category: "Internet",
            householdId: null,
            recurrence: "MONTHLY",
            events: [],
          },
        ],
      }}
    />
  );
}
