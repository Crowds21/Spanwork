/**
 * Sonner Toaster：全局 toast 容器（习惯打卡庆祝等）
 */
import { Toaster as Sonner, type ToasterProps } from 'sonner';

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      position="top-center"
      offset={{
        top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
      }}
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          title: 'group-[.toast]:font-semibold',
          description: 'group-[.toast]:text-muted-foreground group-[.toast]:leading-relaxed',
        },
      }}
      {...props}
    />
  );
}
