import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Zap, RefreshCw, Shield } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const features = [
  {
    icon: Zap,
    title: "极速响应",
    description: "毫秒级任务状态同步，让团队协作零延迟",
    image: "/images/feature-focus.jpg",
    gradient: "from-amber-400 to-orange-500",
  },
  {
    icon: RefreshCw,
    title: "实时同步",
    description: "多端实时数据同步，确保所有人看到最新状态",
    image: "/images/feature-sync.jpg",
    gradient: "from-emerald-400 to-teal-500",
  },
  {
    icon: Shield,
    title: "安全加密",
    description: "企业级数据加密，保障团队信息安全",
    image: "/images/feature-security.jpg",
    gradient: "from-blue-400 to-indigo-500",
  },
];

export function FeatureSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const cards = cardsRef.current.filter(Boolean) as HTMLDivElement[];

    // Initial state
    gsap.set(cards, {
      rotateY: 180,
      xPercent: -100,
      opacity: 0,
    });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: container,
        pin: true,
        start: "top top",
        end: "+=200%",
        scrub: 1,
      },
    });

    tl.to(cards, {
      rotateY: 0,
      xPercent: 0,
      opacity: 1,
      stagger: 0.15,
      duration: 1,
      ease: "power2.out",
    });

    return () => {
      ScrollTrigger.getAll().forEach((st) => {
        if (st.vars.trigger === container) st.kill();
      });
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full min-h-screen flex items-center justify-center overflow-hidden"
    >
      <div className="text-center mb-10 absolute top-16 left-0 right-0">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">赋能每一次协作</h2>
        <p className="text-gray-500 text-base">为高效团队打造的专业工具</p>
      </div>

      <div className="perspective-1000 flex items-center justify-center gap-8 px-8 mt-20">
        {features.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <div
              key={feature.title}
              ref={(el) => { cardsRef.current[index] = el; }}
              className="backface-hidden w-[300px] h-[380px] glass-card p-6 flex flex-col items-center text-center shadow-xl"
              style={{
                transformStyle: "preserve-3d",
              }}
            >
              <div className="w-full h-40 rounded-xl overflow-hidden mb-5">
                <img
                  src={feature.image}
                  alt={feature.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 shadow-lg`}
              >
                <Icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                {feature.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
