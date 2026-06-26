import type { ProjectType } from '@spanwork/shared-types';

import type { Translator } from './translate';

export function projectTypeLabelI18n(type: ProjectType, t: Translator): string {
  return t(`projectType.${type}`);
}
