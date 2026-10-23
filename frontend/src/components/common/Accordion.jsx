import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Accordion({ id, open, onToggle, header, children }) {
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={onToggle}
        className="flex w-full flex-wrap items-center gap-3 px-5 py-4 text-left text-sm font-medium text-slate-200 hover:bg-[#111c33]"
      >
        {header}
        <ChevronDown
          className={cn(
            'size-[18px] flex-none text-slate-400 transition-transform duration-200 motion-reduce:transition-none',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div id={`${id}-panel`} className="border-t border-slate-800">
          {children}
        </div>
      )}
    </div>
  )
}
