"use client";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
export function Dialog({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="overlay" />
        <D.Content className="dialog">
          <D.Title>{title}</D.Title>
          <D.Description className="muted">
            Lengkapi informasi berikut untuk menyimpan catatan Anda.
          </D.Description>
          <D.Close className="close" aria-label="Tutup">
            <X size={20} />
          </D.Close>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
