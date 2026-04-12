import Dashboard from "@/components/Dashboard";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  return <Dashboard slug={slug} />;
}
