import React from 'react';
import { ArrowRight, Gauge, Layers, TrendingUp } from 'lucide-react';

type Project = {
  id: string;
  title: string;
  heroImage: string;
  imageAlt: string;
  problem: string;
  solution: string;
  technologies: string[];
  value: string;
};

const projects: Project[] = [
  {
    id: 'project-01',
    title: 'Lead Discovery Intelligence',
    heroImage: '/portfolio/project-01/hero-16x10@2x.svg',
    imageAlt: 'Lead Discovery dashboard mockup',
    problem:
      'Satış ekipleri doğru işletmeleri manuel araştırdığı için haftalık pipeline üretimi gecikiyordu.',
    solution:
      'Google Maps + AI skorlama akışı ile lokasyon, kategori ve potansiyele göre otomatik lead listeleri üretildi.',
    technologies: ['React', 'TypeScript', 'Google APIs', 'Tailwind CSS'],
    value: 'Haftalık nitelikli lead hacminde +%42 artış',
  },
  {
    id: 'project-02',
    title: 'Autonomous Outreach Flow',
    heroImage: '/portfolio/project-02/hero-16x10@2x.svg',
    imageAlt: 'Outreach automation workflow mockup',
    problem:
      'İlk temas mailleri dağınık şablonlarla atıldığı için yanıt oranı düşük, takipler düzensizdi.',
    solution:
      'Persona tabanlı şablonlar ve 3/7/12 gün otomatik follow-up sekansları ile tutarlı bir outreach sistemi kuruldu.',
    technologies: ['React Router', 'AI Prompting', 'Local Storage', 'Email Workflow'],
    value: 'İlk yanıt oranında +%31 iyileşme',
  },
  {
    id: 'project-03',
    title: 'Meeting Conversion Assistant',
    heroImage: '/portfolio/project-03/hero-16x10@2x.svg',
    imageAlt: 'Calendar assistant booking mockup',
    problem:
      'Yanıt veren potansiyel müşteriler toplantı zamanlamasında kayboluyor, dönüşüm fırsatı kaçıyordu.',
    solution:
      'Takvim boşluklarını analiz edip uygun zaman öneren, onay sonrası etkinlik oluşturan randevu akışı tasarlandı.',
    technologies: ['Google Calendar', 'State Machines', 'UX Writing', 'Analytics'],
    value: 'Demo toplantıya dönüşüm süresinde 2.1 gün hızlanma',
  },
];

const ProjectShowcase: React.FC = () => {
  return (
    <section className="space-y-4" aria-label="Proje vitrin alanı">
      <div className="text-center md:text-left space-y-2">
        <p className="text-xs tracking-[0.2em] uppercase text-indigo-600 font-semibold">Portfolio</p>
        <h3 className="text-2xl md:text-3xl font-bold text-slate-900">Proje Vitrini</h3>
        <p className="text-slate-600 max-w-3xl">
          Mobilde yatay swipe kart deneyimi, desktop&apos;ta ise tam ekran section geçişli bir keşif akışı
          sunar. Her projede problem/çözüm, teknoloji etiketi ve sonuç metriği birlikte gösterilir.
        </p>
      </div>

      <div className="md:hidden -mx-4 px-4 overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-4 w-max pb-2">
          {projects.map((project) => (
            <article
              key={project.id}
              className="snap-center w-[88vw] max-w-sm bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
            >
              <img src={project.heroImage} alt={project.imageAlt} className="w-full aspect-[16/10] object-cover" />
              <div className="p-5 space-y-3">
                <h4 className="text-lg font-semibold text-slate-900">{project.title}</h4>
                <div className="space-y-2 text-sm text-slate-600">
                  <p>
                    <strong className="text-slate-800">Problem:</strong> {project.problem}
                  </p>
                  <p>
                    <strong className="text-slate-800">Çözüm:</strong> {project.solution}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {project.technologies.map((tech) => (
                    <span
                      key={tech}
                      className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full">
                  <TrendingUp size={14} />
                  {project.value}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="hidden md:block h-[85vh] overflow-y-auto snap-y snap-mandatory rounded-2xl border border-slate-200 bg-slate-950/95">
        {projects.map((project, index) => (
          <article
            key={project.id}
            className="min-h-[85vh] snap-start px-10 py-12 lg:px-16 grid lg:grid-cols-2 gap-8 items-center"
          >
            <div className="space-y-5 text-white">
              <p className="inline-flex items-center gap-2 text-sm text-indigo-200">
                <Layers size={16} />
                Section {index + 1}
              </p>
              <h4 className="text-4xl font-bold leading-tight">{project.title}</h4>
              <div className="space-y-3 text-slate-200">
                <p>
                  <strong className="text-white">Problem:</strong> {project.problem}
                </p>
                <p>
                  <strong className="text-white">Çözüm:</strong> {project.solution}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {project.technologies.map((tech) => (
                  <span
                    key={tech}
                    className="px-3 py-1 rounded-full border border-white/20 text-xs font-medium text-indigo-100"
                  >
                    {tech}
                  </span>
                ))}
              </div>
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-300 bg-emerald-900/40 px-3 py-2 rounded-full border border-emerald-300/20">
                <Gauge size={14} />
                {project.value}
              </p>
              <p className="inline-flex items-center gap-2 text-sm text-slate-300">
                Detayları incelemek için aşağı kaydırın <ArrowRight size={14} className="rotate-90" />
              </p>
            </div>
            <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
              <img src={project.heroImage} alt={project.imageAlt} className="w-full aspect-[16/10] object-cover" />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default ProjectShowcase;
