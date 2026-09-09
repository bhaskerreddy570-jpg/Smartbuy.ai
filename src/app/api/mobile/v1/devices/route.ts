import { featureRemovedResponse } from '@/lib/api/feature-removed';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return featureRemovedResponse('Mobile device registration');
}
