/**
 * Sonner Toaster：全局 toast 容器（习惯打卡庆祝等）
 */
import { Toaster as Sonner, type ToasterProps } from 'sonner';

export function Toaster(props: ToasterProps) {
  const safeTopOffset = 'var(--toast-offset-top)';

  return (
    <Sonner
      className="toaster group"
      position="top-center"
      offset={{
        top: safeTopOffset,
      }}
      mobileOffset={{
        top: safeTopOffset,
      }}
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg max-w-[min(100vw-2rem,24rem)]',
          title: 'group-[.toast]:font-semibold',
          description: 'group-[.toast]:text-muted-foreground group-[.toast]:leading-relaxed',
        },
      }}
      {...props}
    />
  );
}
