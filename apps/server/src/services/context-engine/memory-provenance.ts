import { canonicalSha256 } from '../../common/canonical-json';

export type MemoryClaim = {
  id: string;
  category: 'user_fact' | 'companion_fact' | 'relationship_fact' | 'shared_event' | 'current_arc';
  content: string;
  sourceMessageIds: string[];
  sourceRoles: Array<'user' | 'assistant'>;
  originatingRevisionId?: string;
  evidenceLevel:
    | 'explicit_user'
    | 'confirmed_user'
    | 'repeated_user'
    | 'assistant_event'
    | 'inferred';
  status: 'active' | 'superseded' | 'disputed';
};
export type CompanionMemoryRevisionData = {
  claims: MemoryClaim[];
  relationshipSummary: { content: string; sourceClaimIds: string[] };
  currentArc: { content: string; sourceClaimIds: string[] };
};

export function validateMemoryRevisionData(data: CompanionMemoryRevisionData): {
  dataHash: string;
} {
  const ids = new Set<string>();
  for (const claim of data.claims) {
    if (
      !claim.id ||
      ids.has(claim.id) ||
      !claim.sourceMessageIds.length ||
      claim.sourceMessageIds.length !== claim.sourceRoles.length
    ) {
      throw new Error('MEMORY_CLAIM_PROVENANCE_INVALID');
    }
    if (claim.category === 'user_fact' && !claim.sourceRoles.includes('user')) {
      throw new Error('MEMORY_USER_FACT_REQUIRES_USER_EVIDENCE');
    }
    if (
      (claim.evidenceLevel === 'explicit_user' ||
        claim.evidenceLevel === 'confirmed_user' ||
        claim.evidenceLevel === 'repeated_user') &&
      !claim.sourceRoles.includes('user')
    ) {
      throw new Error('MEMORY_EVIDENCE_LEVEL_INVALID');
    }
    ids.add(claim.id);
  }
  for (const projection of [data.relationshipSummary, data.currentArc]) {
    if (projection.content.trim() && !projection.sourceClaimIds.length)
      throw new Error('MEMORY_PROJECTION_UNSUPPORTED');
    if (projection.sourceClaimIds.some((id) => !ids.has(id)))
      throw new Error('MEMORY_PROJECTION_CLAIM_NOT_FOUND');
  }
  return { dataHash: canonicalSha256(data) };
}
