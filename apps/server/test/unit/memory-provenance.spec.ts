import { describe, expect, it } from 'vitest';
import { validateMemoryRevisionData } from '../../src/services/context-engine/memory-provenance';

describe('memory provenance', () => {
  it('rejects assistant-only user facts and unsupported projections', () => {
    expect(() =>
      validateMemoryRevisionData({
        claims: [
          {
            id: 'c',
            category: 'user_fact',
            content: 'x',
            sourceMessageIds: ['a'],
            sourceRoles: ['assistant'],
            evidenceLevel: 'assistant_event',
            status: 'active'
          }
        ],
        relationshipSummary: { content: 'x', sourceClaimIds: ['c'] },
        currentArc: { content: '', sourceClaimIds: [] }
      })
    ).toThrow('MEMORY_USER_FACT_REQUIRES_USER_EVIDENCE');
    expect(() =>
      validateMemoryRevisionData({
        claims: [],
        relationshipSummary: { content: 'invented', sourceClaimIds: [] },
        currentArc: { content: '', sourceClaimIds: [] }
      })
    ).toThrow('MEMORY_PROJECTION_UNSUPPORTED');
  });

  it('returns a deterministic hash for valid claims and projections', () => {
    const data = {
      claims: [
        {
          id: 'c',
          category: 'user_fact' as const,
          content: 'likes tea',
          sourceMessageIds: ['u'],
          sourceRoles: ['user' as const],
          evidenceLevel: 'explicit_user' as const,
          status: 'active' as const
        }
      ],
      relationshipSummary: { content: 'likes tea', sourceClaimIds: ['c'] },
      currentArc: { content: '', sourceClaimIds: [] }
    };
    expect(validateMemoryRevisionData(data).dataHash).toBe(
      validateMemoryRevisionData(data).dataHash
    );
  });
});
