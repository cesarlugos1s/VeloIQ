/**
 * VigilantIQ Journey Runner — executes a journey.
 *
 * Reached at /journey-run/:journeyId (e.g. from a journey entry in the menu).
 * Loads the journey definition, walks its steps starting from the start step
 * and following transitions, and renders each step's model view inline using
 * the host app's Dynamic components. A step tracker shows progress; Back / Next
 * / Finish navigate the sequence. A journey instance is created on start and
 * marked completed on finish for traceability.
 *
 * Self-contained: @juicemantics/veloiq-ui exports + antd + react-router only.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
    Typography, Card, Button, Steps, Space, Spin, Empty, Tag, message, Result,
} from "antd";
import {
    NodeIndexOutlined, ArrowLeftOutlined, ArrowRightOutlined, CheckOutlined,
} from "@ant-design/icons";
import {
    API_URL, authenticatedFetch, useAllModels,
    DynamicCreate, DynamicEdit, DynamicShow,
} from "@juicemantics/veloiq-ui";

const { Title, Text, Paragraph } = Typography;
const JOURNEYS = `${API_URL}/journeys`;
const INSTANCES = `${API_URL}/journey-instances`;

interface StepDef { step_id: string; model_name: string; view_type: string; step_description?: string; }
interface Transition { from_step_id: string; to_step_id: string; condition?: string; }
interface JourneyDef {
    journey_id: string; name: string; description?: string;
    start_step_id: string; steps: Record<string, StepDef>; transitions: Transition[];
}

export default function JourneyRunner() {
    const { journeyId } = useParams<{ journeyId: string }>();
    const allModels = useAllModels();
    const [def, setDef] = useState<JourneyDef | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sequence, setSequence] = useState<string[]>([]); // ordered step ids being walked
    const [current, setCurrent] = useState(0);
    const [instanceId, setInstanceId] = useState<string | null>(null);
    const [finished, setFinished] = useState(false);

    // Build a linear walk from start following the first transition out of each step.
    const buildSequence = (d: JourneyDef): string[] => {
        const seq: string[] = [];
        const seen = new Set<string>();
        let cur = (d.start_step_id && d.steps[d.start_step_id]) ? d.start_step_id : Object.keys(d.steps)[0];
        while (cur && d.steps[cur] && !seen.has(cur)) {
            seq.push(cur); seen.add(cur);
            const next = d.transitions.find((t) => t.from_step_id === cur && d.steps[t.to_step_id]);
            cur = next ? next.to_step_id : "";
        }
        // Append any unreachable steps so they are still runnable.
        Object.keys(d.steps).forEach((sid) => { if (!seen.has(sid)) seq.push(sid); });
        return seq;
    };

    useEffect(() => {
        if (!journeyId) return;
        setLoading(true);
        authenticatedFetch(`${JOURNEYS}/${journeyId}`)
            .then(async (res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const d: JourneyDef = await res.json();
                setDef(d);
                setSequence(buildSequence(d));
                // Start an instance for traceability (best-effort).
                try {
                    const instRes = await authenticatedFetch(INSTANCES, {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            journey_id: d.journey_id, journey_name: d.name, status: "running",
                            current_step_id: d.start_step_id, pending_step_ids: [], completed_step_ids: [],
                            payload: {}, touched_objects: [],
                        }),
                    });
                    if (instRes.ok) { const inst = await instRes.json(); setInstanceId(inst.instance_id); }
                } catch { /* instance tracking is best-effort */ }
            })
            .catch(() => setError("Failed to load journey. It may have been deleted."))
            .finally(() => setLoading(false));
    }, [journeyId]);

    const stepId = sequence[current];
    const step: StepDef | undefined = def?.steps[stepId];
    const stepModel = useMemo(
        () => step ? allModels.find((m) => (m.resource || m.name) === step.model_name
            || m.name.toLowerCase() === step.model_name.toLowerCase()) : undefined,
        [step, allModels]);

    const updateInstance = async (patch: Record<string, unknown>) => {
        if (!instanceId || !def) return;
        try {
            await authenticatedFetch(`${INSTANCES}/${instanceId}`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ journey_id: def.journey_id, journey_name: def.name, ...patch }),
            });
        } catch { /* best-effort */ }
    };

    const goNext = () => {
        if (current < sequence.length - 1) {
            const ni = current + 1;
            setCurrent(ni);
            updateInstance({ status: "running", current_step_id: sequence[ni], completed_step_ids: sequence.slice(0, ni) });
        } else {
            setFinished(true);
            updateInstance({ status: "completed", completed_step_ids: sequence, current_step_id: stepId });
            message.success("Journey completed");
        }
    };
    const goBack = () => { if (current > 0) setCurrent(current - 1); };

    if (loading) return <div style={{ padding: 60, textAlign: "center" }}><Spin size="large" /></div>;
    if (error) return <Result status="error" title="Journey not available" subTitle={error} />;
    if (!def) return <Empty description="Journey not found" style={{ padding: 60 }} />;
    if (finished)
        return <Result status="success" title={`${def.name} completed`}
            subTitle="All steps in this journey have been completed."
            extra={<Button type="primary" onClick={() => { setFinished(false); setCurrent(0); }}>Run again</Button>} />;

    const renderStepView = () => {
        if (!step) return <Empty description="Step not found" />;
        if (!stepModel) return <Empty description={`Model "${step.model_name}" not found in this app`} />;
        const props = { model: stepModel as any, allModels };
        switch (step.view_type) {
            case "edit": return <DynamicEdit {...props} />;
            case "show": return <DynamicShow {...props} />;
            case "list": return <DynamicShow {...props} />; // list-as-context fallback
            case "create":
            default: return <DynamicCreate {...props} />;
        }
    };

    return (
        <div style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>
            <Space style={{ marginBottom: 12 }}>
                <NodeIndexOutlined style={{ fontSize: 22, color: "#1677ff" }} />
                <Title level={4} style={{ margin: 0 }}>{def.name}</Title>
                <Tag color="blue">running</Tag>
            </Space>
            {def.description && <Paragraph type="secondary">{def.description}</Paragraph>}

            <Steps
                size="small"
                current={current}
                style={{ marginBottom: 16 }}
                items={sequence.map((sid) => ({
                    title: sid,
                    description: def.steps[sid] ? `${def.steps[sid].view_type}` : undefined,
                }))}
            />

            <Card
                size="small"
                title={
                    <Space>
                        <Text strong>{stepId}</Text>
                        {step && <Tag>{step.view_type} · {stepModel?.label || step.model_name}</Tag>}
                    </Space>
                }
            >
                {step?.step_description && <Paragraph type="secondary">{step.step_description}</Paragraph>}
                <div style={{ border: "1px solid #f0f0f0", borderRadius: 6, padding: 8 }}>
                    {renderStepView()}
                </div>
            </Card>

            <Space style={{ marginTop: 16, justifyContent: "space-between", width: "100%" }}>
                <Button icon={<ArrowLeftOutlined />} onClick={goBack} disabled={current === 0}>Back</Button>
                {current < sequence.length - 1 ? (
                    <Button type="primary" onClick={goNext}>Next <ArrowRightOutlined /></Button>
                ) : (
                    <Button type="primary" icon={<CheckOutlined />} onClick={goNext}>Finish</Button>
                )}
            </Space>
        </div>
    );
}
