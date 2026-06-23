/**
 * 设置页（占位）：设备与数据管理入口，M5 扩展
 */
import { Link } from '@tanstack/react-router';
import { Tags } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">设置</h1>
        <p className="mt-1 text-muted-foreground">应用偏好与数据管理</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">项目分类</CardTitle>
          <CardDescription>管理项目分组与颜色标签</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link to="/project-categories">
              <Tags className="size-4" />
              打开项目分类
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-lg text-muted-foreground">更多设置</CardTitle>
          <CardDescription>设备名称、数据导出与同步将在 M5 交付</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
