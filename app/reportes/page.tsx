import { ReportesPage } from '@/components/pages/ReportesPage';

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ year?: string; from?: string; to?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  return <ReportesPage searchParams={sp} />;
}
