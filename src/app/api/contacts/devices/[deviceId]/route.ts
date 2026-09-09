import { featureRemovedResponse } from '@/lib/api/feature-removed';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE() {
  return featureRemovedResponse('Contact device management');
}
