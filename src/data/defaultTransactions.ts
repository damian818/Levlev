import { Transaction, BudgetGoal, RecurringRule, InflationPoint, CategoryItem, AccountItem } from '../types';
import Papa from 'papaparse';

export const rawCsvSample = `Date,Title,Category,Account,Amount,Currency,Type,Transfer Amount,Transfer Currency,To Account,Receive Amount,Receive Currency,Description,Due Date,ID
2026-11-19T12:51:19.046,Equus,Regalos,Visa BBVA,"9,983.33",ARS,EXPENSE,,,,,,6/6,,f596d5f9-f8c5-4d38-83f1-9b8b4efcefbe
2026-11-12T00:56:56.942,Franquicia,Transporte,Master BBVA,"134,666.66",ARS,EXPENSE,,,,,,6/6,,3096b2da-46bf-4ebb-8660-70e2a1d071d8
2026-10-19T12:51:12.926,Equus,Regalos,Visa BBVA,"9,983.33",ARS,EXPENSE,,,,,,5/6,,d8b6b231-2de9-47a7-b5b0-0294fd0e4876
2026-10-12T00:57:01.283,Franquicia,Transporte,Master BBVA,"134,666.66",ARS,EXPENSE,,,,,,5/6,,e407a889-6a5b-4f9a-b52c-446823fc1259
2026-09-19T12:51:11.116,Equus,Regalos,Visa BBVA,"9,983.33",ARS,EXPENSE,,,,,,4/6,,3c0dbd8c-70c5-4feb-baeb-bbe653eb5437
2026-09-12T00:57:02.984,Franquicia,Transporte,Master BBVA,"134,666.66",ARS,EXPENSE,,,,,,4/6,,c5213361-2586-4224-9d73-8bea11663267
2026-09-01T11:18:42.26,Mimo,Ropa,Visa Santander,"23,300.00",ARS,EXPENSE,,,,,,3/3,,6208893c-ec00-4a1f-9643-f34af3e208d4
2026-08-19T12:53:39.34,Broer,Regalos,Visa BBVA,"12,396.66",ARS,EXPENSE,,,,,,3/3,,daed1293-2f3e-4ebc-b3f4-9914988b56e0
2026-08-19T12:51:09.851,Equus,Regalos,Visa BBVA,"9,983.33",ARS,EXPENSE,,,,,,3/6,,586315b8-7c83-475e-9627-aac3cda421ca
2026-08-17T11:29:22.944,Crocs,Ropa,Visa Santander,"4,444.33",ARS,EXPENSE,,,,,,9/9,,6fb2793c-63dd-48ab-a983-488351083b7f
2026-08-13T13:24:30.978,Neumen,Transporte,Visa BBVA,"9,400.00",ARS,EXPENSE,,,,,,6/6,,0e4ce56a-ee7d-4162-9ecb-d6ff8e609e1a
2026-08-12T00:57:04.561,Franquicia,Transporte,Master BBVA,"134,666.66",ARS,EXPENSE,,,,,,3/6,,42b4c455-e0d9-4768-997f-f7392341c778
2026-08-05T13:53:05.046,,,BBVA,0.00,ARS,TRANSFER,"1,000.00",ARS,Cocos ARS,"1,000.00",ARS,,,38620f25-179c-44bc-bad1-bd7cae54d4e0
2026-08-05T13:29:42.648,AFIP Autonomo,Facturas y tarifas,Visa BBVA,"148,006.32",ARS,EXPENSE,,,,,,,7b1410a7-139b-4382-9d9f-25d5055c8b6b
2026-08-05T10:51:13.002,,,DollarApp ARS,0.00,ARS,TRANSFER,"3,124,332.54",ARS,Personal Pay,"3,124,332.54",ARS,,,5bc5d39a-83e8-4b71-80b8-2f6af20f2bd1
2026-08-05T10:50:00.098,Adjust balance,,DollarApp ARS,12.54,ARS,INCOME,,,,,,,bba601d4-092f-45ea-9aef-98e479a9ebcc
2026-08-05T10:49:43.419,,,DollarApp,0.00,USD,TRANSFER,"2,000.00",USD,DollarApp ARS,"3,124,320.00",ARS,,,654e7034-41bb-4f79-861a-af5cc50f4ce3
2026-08-05T10:48:06.628,Recibir DollarApp,Facturas y tarifas,DollarApp,3.00,USD,EXPENSE,,,,,,,ec015e3f-6b02-48d0-ac1f-d861c0c4c958
2026-08-05T10:47:49.099,,,Deel,0.00,USD,TRANSFER,"2,210.37",USD,DollarApp,"2,210.37",USD,,,14d863ad-fc56-46a0-9f91-342a585ec76d
2026-08-05T10:47:12.695,Interes,Inversiones,Deel,3.14,USD,INCOME,,,,,,,71fc6e64-5272-46fd-9064-64182fbf91a5
2026-08-05T08:35:54.366,Didi,Transporte,Visa BBVA,"5,500.00",ARS,EXPENSE,,,,,,,ed5da4af-25b2-48e6-8fed-c2fb6fcb9219
2026-08-04T16:33:31.516,Mazzo Cafe,Restaurant,Visa BBVA,"5,800.00",ARS,EXPENSE,,,,,,,a73897d9-261d-483c-a475-b93ef2d578dd
2026-08-04T12:04:33.829,Adjust balance,,Efectivo,100.00,ARS,INCOME,,,,,,,3cccc134-5f6e-468a-bacd-9a446feo501a
2026-08-04T11:59:16.042,Megapastas,Alimentos y Bebidas,BBVA,"36,000.00",ARS,EXPENSE,,,,,,,689494e6-cc9f-410c-82bd-b6d90c7587b6
2026-08-04T11:59:05.346,Shiru,Hogar,Efectivo,"30,000.00",ARS,INCOME,,,,,,,4307723c-cb7c-46f4-aa4f-d80d02ef5801
2026-08-04T11:58:48.16,Tzedaka,Hogar,Efectivo,50.00,ARS,EXPENSE,,,,,,,9632bf5b-7f6c-4def-95cd-543f35e3414e
2026-08-04T11:37:53.427,Telas,Educación,Efectivo,"3,700.00",ARS,EXPENSE,,,,,,,d7bd6648-035e-4af0-8a43-e3a29af4cb8f
2026-08-04T11:37:45.286,Telas,Educación,Efectivo,"24,500.00",ARS,EXPENSE,,,,,,,0fc2618e-c21a-4882-9170-538a66c03bdf
2026-08-04T11:37:30.471,Mercera,Educación,Efectivo,"3,000.00",ARS,EXPENSE,,,,,,,99e7db73-d52d-4a00-88d5-289c74f69f4e
2026-08-04T11:37:15.795,Librera,Educación,BBVA,"20,500.00",ARS,EXPENSE,,,,,,,bb85ec93-535a-4c93-a4f9-2670b624b1de
2026-08-04T11:36:58.364,Hi Coffee,Restaurant,Visa BBVA,"6,750.00",ARS,EXPENSE,,,,,,,1802c5fc-7afb-4949-86af-1450b480875b
2026-08-04T09:45:23.07,Ortodoncia,Salud,Efectivo USD,"1,000.00",USD,EXPENSE,,,,,,,015e733b-0898-42b8-9538-432d340bcded
2026-08-04T08:58:18.612,Didi,Transporte,Visa BBVA,"5,100.00",ARS,EXPENSE,,,,,,,06bfeb10-1196-4f3e-a82d-9c20a5f5bee5
2026-08-04T08:02:01.587,Comisin Transferencia,Inversiones,Deel,5.00,USD,EXPENSE,,,,,,,dfd3999e-a141-4b90-9f56-6d45082d8a02
2026-08-04T00:14:12.214,AFIP Monotributo,Facturas y tarifas,Visa BBVA,"349,312.73",ARS,EXPENSE,,,,,,,9cf0308d-0298-4089-b68d-e3cb7ce9e7c8
2026-08-04T00:12:38.825,ABL Jean Jaures,Facturas y tarifas,Bueppa,"5,685.24",ARS,EXPENSE,,,,,,,351272a3-2011-4224-bd03-6b89c1f822ae
2026-08-04T00:11:22.35,ABL Jean Jaures,Facturas y tarifas,Bueppa,"38,285.71",ARS,EXPENSE,,,,,,,4f3e03af-7012-4ed5-983c-e8dc8ee13408
2026-08-04T00:09:09.206,Patente,Facturas y tarifas,Bueppa,"10,000.00",ARS,INCOME,,,,,,,c6641a40-dd00-4fb6-8614-12ac73f8f7dd
2026-08-04T00:08:59.832,Patente,Facturas y tarifas,Bueppa,"105,644.35",ARS,EXPENSE,,,,,,,43624ac8-f3b3-4302-ad36-2dc5ff79f321
2026-08-04T00:06:47.936,,,BBVA,0.00,ARS,TRANSFER,"150,000.00",ARS,Bueppa,"150,000.00",ARS,,,0b165dac-79a0-41dc-a3c3-ef57ba5d7165
2026-08-04T00:05:51.169,,,DollarApp ARS,0.00,ARS,TRANSFER,"310,636.39",ARS,BBVA,"310,636.39",ARS,,,344476f1-11cd-43b2-bc02-c48494959863
2026-08-04T00:04:34.224,Tarjeta Master BBVA,Tarjetas de Crédito,DollarApp ARS,0.00,ARS,TRANSFER,"178,624.99",ARS,Master BBVA,"178,624.99",ARS,,,d0793e33-a292-4574-9bff-1c5d924ef3d1
2026-08-03T23:44:24.758,Tarjeta Visa BBVA,Tarjetas de Crédito,BBVA USD,3.73,USD,EXPENSE,,,,,,,2bdc313d-de85-469a-9ae2-898b3087696d
2026-08-03T23:43:02.797,Didi,Transporte,Visa BBVA,"3,800.00",ARS,EXPENSE,,,,,,,ec98e771-f85d-45b5-8a68-8fbfd5a81806
2026-08-03T23:38:42.898,,,DollarApp ARS,0.00,ARS,TRANSFER,"70,000.00",ARS,Personal Pay,"70,000.00",ARS,,,5256fcfa-639c-4d73-967a-b26bd365f2da
2026-08-03T23:37:42.609,Adjust balance,,Personal Pay,"15,817.23",ARS,INCOME,,,,,,,832e9a25-baca-4f51-a811-2d4f4bd3a6c0
2026-08-03T23:36:35.353,Tarjeta Visa Comafi,Tarjetas de Crédito,DollarApp ARS,0.00,ARS,TRANSFER,"90,018.11",ARS,ICBC/Comafi Visa,"90,018.11",ARS,,,958a6fe1-dc89-4332-8f9e-caabebata7ee93
2026-08-03T23:33:29.599,Tarjeta Visa Comafi,Tarjetas de Crédito,ICBC/Comafi,0.00,ARS,TRANSFER,"10,000.00",ARS,ICBC/Comafi Visa,"10,000.00",ARS,,,82155eb9-7896-448b-ab9b-a5074555793e
2026-08-03T23:31:55.295,Interes,Inversiones,BBVA,8.28,ARS,INCOME,,,,,,,2bb6e2d9-a4ef-41a1-8230-ac12f8e305d4
2026-08-03T23:22:41.048,Cissab Cuota,Hogar,DollarApp ARS,"231,000.00",ARS,EXPENSE,,,,,,,8e090498-0307-4121-bb9f-dbbb7b621055
2026-08-03T23:22:16.943,Expensas,Facturas y tarifas,DollarApp ARS,"594,130.59",ARS,EXPENSE,,,,,,,f2656e8e-7f8a-4edc-ae21-cb46c6adfb64
2026-08-03T22:11:40.926,Tarjeta Visa Santander,Tarjetas de Crédito,DollarApp ARS,0.00,ARS,TRANSFER,"132,635.06",ARS,Visa Santander,"132,635.06",ARS,,,8f1f454f-568e-4eec-b848-d200c6a69a77
2026-08-03T22:11:02.919,Adjust balance,,DollarApp ARS,7.96,ARS,INCOME,,,,,,,d0afpb1b0-a47e-473c-b438-cc7a696ea600
2026-08-03T22:10:43.45,,,DollarApp,0.00,USD,TRANSFER,"1,029.69",USD,DollarApp ARS,"1,607,037.18",ARS,,,5203f3f2-9e3a-474c-aae4-c2fbb4b86354
2026-08-02T23:31:13.045,Carniceria,Alimentos y Bebidas,BBVA,"15,500.00",ARS,EXPENSE,,,,,,,f43fa40d-a507-4e85-b12f-3d9f9f189d62
2026-08-01T23:32:40.927,YPF,Transporte,ICBC/Comafi Visa,"101,026.00",ARS,EXPENSE,,,,,,,7a6ce5c7-33b2-4aae-b65d-ad07864a5596
2026-08-01T23:30:42.791,YPF,Transporte,ICBC/Comafi,"10,000.00",ARS,INCOME,,,,,,,e62dabbdb-4adc-456c-b510-47a3dfc46522
2026-08-01T11:18:29.204,Mimo,Ropa,Visa Santander,"23,300.00",ARS,EXPENSE,,,,,,2/3,,2eaf4544-44fb-4257-a87d-b135950b2754
2026-08-15T12:00:00,Gappyfy,Sueldo,Deel,"5,486.25",USD,INCOME,,,,,,,,90e1d0f9-a189-4232-b027-1770cf3b2291
2026-07-15T07:46:30.74,Gappyfy,Sueldo,Deel,"5,486.25",USD,INCOME,,,,,,,,fee3e634-ae2f-4cfa-bf42-0a875a4f1df0
2026-06-15T10:00:59.157,Gappyfy,Sueldo,Deel,"5,486.25",USD,INCOME,,,,,,,,c8afdf27-094f-4adb-87a6-90ec5688ddd4
2026-05-15T07:27:07.049,Gappyfy,Sueldo,Deel,"5,486.25",USD,INCOME,,,,,,,,c237a342-99bd-49df-8b3d-1875e5b30263
2026-04-15T11:14:13.28,Gappyfy,Sueldo,Deel,"4,389.00",USD,INCOME,,,,,,,,4b68ef5f-e593-4700-a29d-ee134c4f34d1
2026-03-15T12:00:00,Gappyfy,Sueldo,Deel,"5,486.25",USD,INCOME,,,,,,,,8391da40-8bbf-41f2-95cd-223bb3832a81
2026-02-15T12:00:00,Gappyfy,Sueldo,Deel,"5,486.25",USD,INCOME,,,,,,,,6102a11b-7fb4-49c4-85d0-9f5b2140a321
2026-01-15T12:00:00,Gappyfy,Sueldo,Deel,"5,486.25",USD,INCOME,,,,,,,,14285802-39c2-4981-a67b-118c7d039987
2025-12-15T12:00:00,Gappyfy,Sueldo,Deel,"5,486.25",USD,INCOME,,,,,,,,982a572a-9281-4328-984e-83bf018a1291
2025-11-15T12:00:00,Gappyfy,Sueldo,Deel,"5,486.25",USD,INCOME,,,,,,,,2103841a-810a-4a2e-83bf-71283a098d71
2025-10-15T12:00:00,Gappyfy,Sueldo,Deel,"5,486.25",USD,INCOME,,,,,,,,5830129a-2819-4811-92ba-2109840192a2
2025-09-15T12:00:00,Gappyfy,Sueldo,Deel,"5,486.25",USD,INCOME,,,,,,,,82194012-192a-410a-9810-2198042a019e
2025-08-15T12:00:00,Gappyfy,Sueldo,Deel,"5,486.25",USD,INCOME,,,,,,,,10298412-8192-4019-2184-0192840192a1
2026-08-01T10:00:00,Maga,Hogar,BBVA,"3,000,000.00",ARS,INCOME,,,,,,,,a918231c-9281-4029-2184-9102840192a2
2026-07-01T10:00:00,Maga,Hogar,DollarApp,"5,689.29",USD,INCOME,,,,,,,,9182031a-9281-4021-1284-9102840192a3`;

export function parseTransactions(csvText: string): Transaction[] {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const rawRows = result.data as any[];
  return rawRows.map((row, index) => {
    // Clean numeric values that might contain commas inside quotes like "9,983.33"
    const cleanNum = (val: any) => {
      if (!val) return 0;
      if (typeof val === 'number') return val;
      const cleaned = val.toString().replace(/"/g, '').replace(/,/g, '').trim();
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    };

    const dateVal = (row['Date'] && row['Date'].trim()) || 
                    (row['Due Date'] && row['Due Date'].trim()) || 
                    (row['Description'] && row['Description'].startsWith('202') ? row['Description'].trim() : new Date().toISOString());

    return {
      id: row['ID'] || `tx-${index}-${Math.random().toString(36).substring(2, 9)}`,
      date: dateVal,
      title: row['Title'] || row['Category'] || 'Untitled',
      category: row['Category'] || 'General',
      account: row['Account'] || 'Cash',
      amount: cleanNum(row['Amount']),
      currency: row['Currency'] || 'ARS',
      type: (row['Type'] as any) || 'EXPENSE',
      transferAmount: row['Transfer Amount'] ? cleanNum(row['Transfer Amount']) : undefined,
      transferCurrency: row['Transfer Currency'] || undefined,
      toAccount: row['To Account'] || undefined,
      receiveAmount: row['Receive Amount'] ? cleanNum(row['Receive Amount']) : undefined,
      receiveCurrency: row['Receive Currency'] || undefined,
      description: row['Description'] || undefined,
      dueDate: row['Due Date'] || undefined,
      installments: row['ID'] ? undefined : (row['Description'] && row['Description'].includes('/') ? row['Description'] : undefined),
    };
  }).filter(t => t.date && (!isNaN(t.amount) || (t.transferAmount && !isNaN(t.transferAmount))));
}

export const defaultBudgets: BudgetGoal[] = [
  { category: 'Alimentos y Bebidas', monthlyLimitARS: 450000 },
  { category: 'Transporte', monthlyLimitARS: 300000 },
  { category: 'Restaurant', monthlyLimitARS: 350000 },
  { category: 'Hogar', monthlyLimitARS: 800000 },
  { category: 'Salud', monthlyLimitARS: 500000 },
  { category: 'Ropa', monthlyLimitARS: 250000 },
  { category: 'Facturas y tarifas', monthlyLimitARS: 600000 },
  { category: 'Educación', monthlyLimitARS: 1000000 },
  { category: 'Regalos', monthlyLimitARS: 200000 },
  { category: 'Inversiones', monthlyLimitARS: 500000 },
];

export const defaultRecurringRules: RecurringRule[] = [
  { id: 'rec-1', title: 'Gappyfy Sueldo (Deel)', category: 'Sueldo', account: 'Deel', amount: 5486.25, currency: 'USD', type: 'INCOME', dayOfMonth: 15 },
  { id: 'rec-2', title: 'Expensas BBVA', category: 'Facturas y tarifas', account: 'BBVA', amount: 570000, currency: 'ARS', type: 'EXPENSE', dayOfMonth: 10 },
  { id: 'rec-3', title: 'OSDE Salud', category: 'Salud', account: 'Visa BBVA', amount: 840000, currency: 'ARS', type: 'EXPENSE', dayOfMonth: 20 },
  { id: 'rec-4', title: 'Cissab Cuota', category: 'Hogar', account: 'BBVA', amount: 231000, currency: 'ARS', type: 'EXPENSE', dayOfMonth: 5 },
  { id: 'rec-5', title: 'Netflix & Spotify', category: 'Facturas y tarifas', account: 'BBVA', amount: 11249, currency: 'ARS', type: 'EXPENSE', dayOfMonth: 7 }
];

// Historical inflation index (simulated monthly Argentina CPI index 2024-2026) vs USD/ARS rate
export const historicalInflationAndFX: InflationPoint[] = [
  { month: '2024-09', inflationIndex: 100, usdArsRate: 1250 },
  { month: '2024-10', inflationIndex: 103.5, usdArsRate: 1280 },
  { month: '2024-11', inflationIndex: 106.2, usdArsRate: 1310 },
  { month: '2024-12', inflationIndex: 109.0, usdArsRate: 1350 },
  { month: '2025-01', inflationIndex: 112.2, usdArsRate: 1380 },
  { month: '2025-02', inflationIndex: 115.0, usdArsRate: 1400 },
  { month: '2025-03', inflationIndex: 117.8, usdArsRate: 1430 },
  { month: '2025-04', inflationIndex: 120.5, usdArsRate: 1460 },
  { month: '2025-05', inflationIndex: 123.1, usdArsRate: 1490 },
  { month: '2025-06', inflationIndex: 125.8, usdArsRate: 1520 },
  { month: '2025-07', inflationIndex: 128.5, usdArsRate: 1550 },
  { month: '2025-08', inflationIndex: 131.2, usdArsRate: 1580 },
  { month: '2025-09', inflationIndex: 134.0, usdArsRate: 1610 },
  { month: '2025-10', inflationIndex: 136.8, usdArsRate: 1640 },
  { month: '2025-11', inflationIndex: 139.7, usdArsRate: 1670 },
  { month: '2025-12', inflationIndex: 142.6, usdArsRate: 1700 },
  { month: '2026-01', inflationIndex: 145.8, usdArsRate: 1450 },
  { month: '2026-02', inflationIndex: 149.0, usdArsRate: 1400 },
  { month: '2026-03', inflationIndex: 152.2, usdArsRate: 1380 },
  { month: '2026-04', inflationIndex: 155.5, usdArsRate: 1448.5 },
  { month: '2026-05', inflationIndex: 158.8, usdArsRate: 1410 },
  { month: '2026-06', inflationIndex: 162.2, usdArsRate: 1480 },
  { month: '2026-07', inflationIndex: 165.6, usdArsRate: 1485 },
  { month: '2026-08', inflationIndex: 169.1, usdArsRate: 1496 },
];

export const defaultCategoryItems: CategoryItem[] = [
  { id: 'cat-1', name: 'Alimentos y Bebidas', type: 'EXPENSE' },
  { id: 'cat-2', name: 'Transporte', type: 'EXPENSE' },
  { id: 'cat-3', name: 'Restaurant', type: 'EXPENSE' },
  { id: 'cat-4', name: 'Hogar', type: 'EXPENSE' },
  { id: 'cat-5', name: 'Salud', type: 'EXPENSE' },
  { id: 'cat-6', name: 'Ropa', type: 'EXPENSE' },
  { id: 'cat-7', name: 'Facturas y tarifas', type: 'EXPENSE' },
  { id: 'cat-8', name: 'Educación', type: 'EXPENSE' },
  { id: 'cat-9', name: 'Regalos', type: 'EXPENSE' },
  { id: 'cat-10', name: 'Inversiones', type: 'BOTH' },
  { id: 'cat-11', name: 'Sueldo', type: 'INCOME' },
  { id: 'cat-12', name: 'Freelance', type: 'INCOME' },
  { id: 'cat-13', name: 'Tarjetas de Crédito', type: 'BOTH' },
  { id: 'cat-14', name: 'Transferencias', type: 'BOTH' },
  { id: 'cat-15', name: 'Entretenimiento', type: 'EXPENSE' },
  { id: 'cat-16', name: 'General', type: 'BOTH' },
];

export const defaultAccountItems: AccountItem[] = [
  { id: 'acc-1', name: 'BBVA', type: 'CHECKING', currency: 'ARS', initialBalance: 280000 },
  { id: 'acc-2', name: 'Santander (ARS)', type: 'CHECKING', currency: 'ARS', initialBalance: 450000 },
  { id: 'acc-3', name: 'ICBC (ARS)', type: 'CHECKING', currency: 'ARS', initialBalance: 150000 },
  { id: 'acc-4', name: 'DollarApp', type: 'WALLET', currency: 'USD', initialBalance: 3200 },
  { id: 'acc-5', name: 'Deel', type: 'WALLET', currency: 'USD', initialBalance: 12450 },
  { id: 'acc-6', name: 'Cocos Capital (ARS)', type: 'INVESTMENT', currency: 'ARS', initialBalance: 1850000 },
  { id: 'acc-7', name: 'Visa BBVA', type: 'CREDIT_CARD', currency: 'ARS', closingRule: { ruleType: 'FIXED_DAY', fixedDay: 25 } },
  { id: 'acc-8', name: 'Master BBVA', type: 'CREDIT_CARD', currency: 'ARS', closingRule: { ruleType: 'FIXED_DAY', fixedDay: 25 } },
  { id: 'acc-9', name: 'Visa Santander', type: 'CREDIT_CARD', currency: 'ARS', closingRule: { ruleType: 'FIXED_DAY', fixedDay: 25 } },
  { id: 'acc-10', name: 'ICBC/Comafi Visa', type: 'CREDIT_CARD', currency: 'ARS', closingRule: { ruleType: 'NTH_WEEKDAY', weekday: 4, nth: 4 } },
];
