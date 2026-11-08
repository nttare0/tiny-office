/**
 * The eight kinds by name, icon and the words that help: what a kind is called, what one of its things is
 * called (Insert's item), the words a new one is made with and the hint under the
 * bar. Kept apart from model.ts so the model stays free of the strings and the icons.
 */
import { Armchair, Blend, Brain, GitCommitHorizontal, Network, Rows3, Share2, TreeDeciduous, type IconNode } from 'lucide';
import { t } from '../../kit/core/i18n.ts';
import type { KindId } from './model.ts';

export const KIND_ICON: Record<KindId, IconNode> = { mind: Brain, org: Network, family: TreeDeciduous, lanes: Rows3, timeline: GitCommitHorizontal, venn: Blend, seating: Armchair, net: Share2 };

export const kindName = (k: KindId): string =>
  ({
    mind: t('diagram-mind-map'),
    org: t('diagram-org-chart'),
    family: t('diagram-family-tree'),
    lanes: t('diagram-swimlanes'),
    timeline: t('diagram-timeline'),
    venn: t('diagram-venn'),
    seating: t('diagram-seating-chart'),
    net: t('diagram-network'),
  })[k];

/** One of its things: Insert ▾ offers "Idea", "Person", "Step"… */
export const thingName = (k: KindId): string =>
  ({
    mind: t('diagram-idea'),
    org: t('diagram-person'),
    family: t('diagram-person'),
    lanes: t('diagram-step'),
    timeline: t('common-event'),
    venn: t('diagram-set'),
    seating: t('common-table'),
    net: t('diagram-thing'),
  })[k];

/** The words a new thing is made with, chosen so the first letter typed replaces them; the placeholder of a thing whose words are all gone. `item`: one thing of a list (a guest at a table, a thing in a set). */
export const newWords = (k: KindId, item = false): string =>
  item
    ? k === 'seating'
      ? t('diagram-guest')
      : t('diagram-thing')
    : {
        mind: t('diagram-new-idea'),
        org: t('common-name'),
        family: t('common-name'),
        lanes: t('diagram-step'),
        timeline: t('diagram-when'),
        venn: t('diagram-set'),
        seating: t('common-table'),
        net: t('diagram-thing'),
      }[k];

/** What the picture does, said once under the bar. */
export const kindHint = (k: KindId): string =>
  ({
    mind: t('diagram-tap-empty-space-for-branch'),
    org: t('diagram-tap-empty-space-for-person'),
    family: t('diagram-tap-person-to-type-on'),
    lanes: t('diagram-tap-in-lane-to-add'),
    timeline: t('diagram-tap-empty-space-for-event'),
    venn: t('diagram-tap-inside-circles-to-add'),
    seating: t('diagram-tap-empty-space-for-table'),
    net: t('diagram-tap-empty-space-for-thing'),
  })[k];
