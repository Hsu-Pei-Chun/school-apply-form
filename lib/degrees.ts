// 學部別選項；獨立成檔讓 client component（申請表下拉）與 DB schema 共用，不會把 DB 相依拉進前端 bundle。
export const DEGREES = ['大學部', '碩士班', '博士班', '在職專班'] as const;
export type Degree = (typeof DEGREES)[number];
