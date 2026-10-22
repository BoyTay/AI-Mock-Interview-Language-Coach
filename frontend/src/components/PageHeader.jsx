export default function PageHeader({ title, description }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-[26px] font-bold tracking-tight text-slate-50">{title}</h1>
      {description && <p className="text-sm text-slate-400">{description}</p>}
    </div>
  )
}
