import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="text-center max-w-4xl mx-auto">
        <div className="mb-10 flex items-center justify-center">
          <Image
            src="/junie-logo.png?v=2"
            alt="Junie logo"
            width={700}
            height={700}
            className="h-80 w-80 md:h-[28rem] md:w-[28rem] object-contain"
            priority
          />
        </div>
        <h1
          className="text-3xl md:text-5xl font-bold tracking-tight mb-8 text-slate-900"
          style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}
        >
          You're just 5 minutes away
        </h1>
        <Link href="/login">
          <Button size="lg" className="gap-2">
            Get Started <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  )
}
