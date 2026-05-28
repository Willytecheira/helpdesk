"use client"

import { useState, useTransition } from "react"
import { Pencil, Plus, Trash2, Loader2, Package } from "lucide-react"
import { toast } from "sonner"
import type { Product } from "@prisma/client"
import { deleteProduct } from "./actions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { ProductForm } from "./product-form"
import { EmptyState } from "@/components/ui/empty-state"

type ProductWithCount = Product & { _count: { systems: number } }

export function ProductsTable({ products }: { products: ProductWithCount[] }) {
  const [newOpen, setNewOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState<Product | null>(null)
  const [pending, start] = useTransition()

  return (
    <>
      <div className="flex items-center justify-between pb-4">
        <p className="text-muted-foreground text-sm">
          {products.length} producto{products.length === 1 ? "" : "s"} en el catálogo
        </p>
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" />
              Nuevo producto
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo producto</DialogTitle>
            </DialogHeader>
            <ProductForm onDone={() => setNewOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Aún no hay productos"
          description="Creá el primer producto de tu catálogo."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Versión</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Sistemas</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-muted-foreground text-xs">{p.slug}</div>
                </TableCell>
                <TableCell>
                  {p.version ? (
                    <Badge variant="outline" className="font-mono text-xs">
                      {p.version}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground max-w-md truncate text-sm">
                  {p.description || "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">{p._count.systems}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditing(p)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleting(p)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar producto</DialogTitle>
          </DialogHeader>
          {editing && (
            <ProductForm product={editing} onDone={() => setEditing(null)} />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar &quot;{deleting?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Si el producto tiene sistemas asociados no se podrá eliminar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                if (!deleting) return
                start(async () => {
                  const r = await deleteProduct(deleting.id)
                  if (r.ok) {
                    toast.success("Producto eliminado")
                    setDeleting(null)
                  } else {
                    toast.error(r.error)
                  }
                })
              }}
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              Eliminar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
