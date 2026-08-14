// frontend/pages/pipeline.tsx
import Head from 'next/head';
import PipelineWorkflow from '../components/PipelineWorkflow';

export default function PipelinePage() {
  return (
    <>
      <Head>
        <title>ASO Design Workspace</title>
        <meta name="description" content="Visual target selection and molecular validation workflows." />
      </Head>
      <div className="bg-slate-950 min-h-screen">
        <PipelineWorkflow />
      </div>
    </>
  );
}