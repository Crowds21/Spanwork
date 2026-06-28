/**
 * 设置页（占位）：设备与数据管理入口，M5 扩展
 */
import { Link } from '@tanstack/react-router';
import { Tags } from 'lucide-react';

import { DevLogPanel } from '@/components/dev/DevLogPanel';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useT } from '@/lib/i18n/useT';

export function SettingsPage() {
  const t = useT();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('settings.title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('settings.categoriesTitle')}</CardTitle>
          <CardDescription>{t('settings.categoriesDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link to="/project-categories">
              <Tags className="size-4" />
              {t('settings.openCategories')}
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('settings.syncTitle')}</CardTitle>
          <CardDescription>{t('settings.syncDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link to="/settings/sync">{t('settings.openSync')}</Link>
          </Button>
        </CardContent>
      </Card>

      <DevLogPanel />

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-lg text-muted-foreground">{t('settings.moreTitle')}</CardTitle>
          <CardDescription>{t('settings.moreDesc')}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
