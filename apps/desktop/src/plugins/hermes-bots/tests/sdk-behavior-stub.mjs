const component = () => null

export function atom(initialValue) {
  let value = initialValue
  const listeners = new Set()

  return {
    get: () => value,
    set: next => {
      value = next
      listeners.forEach(listener => listener(value))
    },
    listen: listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
}

export const Button = component
export const Checkbox = component
export const Codicon = component
export const COMPOSER_AREAS = { atCompletions: 'composer.at-completions', middleware: 'composer.middleware' }
export const ConfirmDialog = component
export const ContextMenu = component
export const ContextMenuContent = component
export const ContextMenuItem = component
export const ContextMenuSeparator = component
export const ContextMenuTrigger = component
export const Dialog = component
export const DialogContent = component
export const DialogDescription = component
export const DialogFooter = component
export const DialogHeader = component
export const DialogTitle = component
export const DropdownMenu = component
export const DropdownMenuContent = component
export const DropdownMenuItem = component
export const DropdownMenuTrigger = component
export const EmptyState = component
export const GlyphSpinner = component
export const Input = component
export const PALETTE_AREA = 'palette'
export const ScrollArea = component
export const SearchField = component
export const Select = component
export const SelectContent = component
export const SelectItem = component
export const SelectTrigger = component
export const SelectValue = component
export const Switch = component
export const Textarea = component
export const Tip = component
export const cn = (...values) => values.filter(Boolean).join(' ')
export const haptic = { trigger: () => undefined }
export const host = {
  activeConnectionId: () => 'local',
  capabilityConnectionScoped: true,
  deleteProfileConnectionScoped: true,
  state: {
    connectionId: atom('local'),
    gateway: atom('closed'),
    profile: atom('default')
  }
}
export const profileColor = () => '#777777'
export const queryClient = { getQueryData: () => null }
export const relativeTime = value => String(value || '')
export const useQuery = () => ({ data: null })
export const useValue = store => store?.get?.()
