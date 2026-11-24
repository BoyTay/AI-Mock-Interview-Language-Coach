import EnglishSwitch from '@/components/english/EnglishSwitch'

export default function SpeakingCoach() {
  return (
    <div className="flex w-full max-w-[1440px] flex-col gap-5">
      <h1 className="sr-only">English Speaking Coach</h1>
      <EnglishSwitch />
    </div>
  )
}
