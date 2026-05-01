import { InversionesPage } from '@/components/pages/InversionesPage';

// La página consulta precios en vivo vía refreshAssetPricesIfStale, así que
// no queremos que Next la pre-renderice estáticamente.
export const dynamic = 'force-dynamic';

export default async function Page() {
  return <InversionesPage />;
}
