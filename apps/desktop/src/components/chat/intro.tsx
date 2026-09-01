import { HomeIntro } from '@/plugins/hermes-vietnamese/home-intro'

export type IntroProps = {
  personality?: string
  seed?: number
}

export function Intro(_props: IntroProps) {
  return <HomeIntro />
}
