const teacherImages = import.meta.glob("../../assets/teachers/*.{png,jpg,jpeg,webp}", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>

const teacherNames: Record<string, { name: string; role: string }> = {
  dangdang: { name: "当当校长", role: "两节课教育校长" },
  wang: { name: "王老师", role: "岗位分析老师" },
  ajie: { name: "阿杰老师", role: "教研老师" },
  li: { name: "李老师", role: "岗位分析老师" },
  zhou: { name: "周老师", role: "金牌教师" },
  zhu: { name: "朱老师", role: "岗位分析老师" },
  rui: { name: "瑞老师", role: "金牌教师" },
  tao: { name: "陶老师", role: "岗位分析老师" },
  hu: { name: "胡老师", role: "岗位分析老师" },
  chen: { name: "陈老师", role: "岗位分析老师" },
  wei: { name: "魏老师", role: "岗位分析老师" },
  fu: { name: "付老师", role: "岗位分析老师" },
  wen: { name: "文老师", role: "岗位分析老师" },
  xiaojuan: { name: "小卷老师", role: "金牌教师" },
  zhang: { name: "张老师", role: "岗位分析老师" },
}

const testimonials = Object.entries(teacherImages).map(([path, image]) => {
  const fileName = path.split("/").pop()?.split(".")[0] ?? ""
  return { image, ...(teacherNames[fileName] ?? { name: "教师团队", role: "两节课教育教师" }) }
})

function StaticTeacherGrid() {
  const order = [
    "当当校长",
    "王老师",
    "陈老师",
    "阿杰老师",
    "李老师",
    "周老师",
    "朱老师",
    "瑞老师",
    "陶老师",
    "胡老师",
    "魏老师",
    "付老师",
    "文老师",
    "小卷老师",
    "张老师",
  ]
  const ordered = [...testimonials].sort((a, b) => {
    const indexA = order.indexOf(a.name)
    const indexB = order.indexOf(b.name)
    return indexA - indexB
  })

  return (
    <div className="teacher-grid">
      {ordered.map((item) => (
        <article className={`teacher-card ${item.name === "当当校长" ? "teacher-card-featured" : ""}`} key={item.name}>
          <img src={item.image} alt={item.name} loading="lazy" />
          <div className="teacher-info"><strong>{item.name}</strong><small>{item.role}</small></div>
        </article>
      ))}
    </div>
  )
}

export function ThreeDTestimonials() {
  return <section className="testimonials-panel" aria-labelledby="testimonials-title"><div className="testimonials-heading"><div><h2 id="testimonials-title">用心做事，真诚做人</h2></div><span>生活能治愈的是愿意好起来的人！</span></div><div className="testimonials-stage testimonials-stage-static"><StaticTeacherGrid /></div></section>
}
