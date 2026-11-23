import { Phone, Mail } from 'lucide-react'

export const AccountFooter = () => {
  return (
    <div className="fixed z-50 bottom-0 left-0 w-full text-center text-muted-foreground sm:text-center bg-background border-t border-border p-3">
      <div className="flex gap-1 justify-center items-center">
        <div>If you have any queries please contact us at</div>
        <div className="flex gap-1 justify-center items-center text-foreground">
          <Mail className="h-4 w-4" />
          <div>email@exampla.com</div>
        </div>
        <div>or call</div>
        <div className="flex gap-1 justify-center items-center text-foreground">
          <Phone className="h-4 w-4" />
          <div>0789101112</div>
        </div>
      </div>
    </div>
  )
}
