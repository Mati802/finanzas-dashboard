import { GastosPage } from '@/components/pages/GastosPage';

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ year?: string; month?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  return <GastosPage searchParams={sp} />;
}
