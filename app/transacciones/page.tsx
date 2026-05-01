import { TransaccionesPage } from '@/components/pages/TransaccionesPage';

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ year?: string; month?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  return <TransaccionesPage searchParams={sp} />;
}
