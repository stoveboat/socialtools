"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const TRACTION_OPTIONS = [
  "Tactical / teaching content",
  "Personal / vulnerable content",
  "Insight / reframe content",
  "Hot-take / contrarian content",
  "I haven't had clear traction yet — I'm still finding my voice.",
];

interface Phase0FormProps {
  topic_summary: string;
  audience_candidates: string[];
  channel_candidates: string[];
  is_low_confidence: boolean;
  action: (formData: FormData) => void;
}

export function Phase0Form({
  topic_summary,
  audience_candidates,
  channel_candidates,
  is_low_confidence,
  action,
}: Phase0FormProps) {
  const [audience, setAudience] = useState<string>("");
  const [channel, setChannel] = useState<string>("");
  const [traction, setTraction] = useState<string>("");

  return (
    <form action={action} className="space-y-6">
      <Panel
        header="I'm reading this as:"
        subhead={topic_summary}
        muted
      >
        <p className="text-xs text-muted-foreground">
          The grader uses this read to score the rest. If it's wrong, override
          your audience or channel below to steer it.
        </p>
      </Panel>

      <Panel
        header="Who is this for?"
        subhead={
          is_low_confidence
            ? "I'm not entirely sure who this is for. Pick the closest match or describe your audience directly."
            : "Based on the script, this looks like a fit for one of these. Confirm or pick a tighter read."
        }
      >
        <CandidateGroup
          name="audience_selection"
          customName="custom_audience"
          options={audience_candidates}
          value={audience}
          onChange={setAudience}
          customLabel="None of these — let me describe my audience"
        />
      </Panel>

      <Panel
        header="What's the channel about?"
        subhead={
          is_low_confidence
            ? "I'm not entirely sure of the channel positioning yet. Pick the closest read or describe it directly."
            : "Based on the script, the channel reads as one of these. Confirm or pick a tighter read."
        }
      >
        <CandidateGroup
          name="channel_selection"
          customName="custom_channel"
          options={channel_candidates}
          value={channel}
          onChange={setChannel}
          customLabel="None of these — let me describe my channel"
        />
      </Panel>

      <Panel
        header="What's been working lately on your channel?"
        subhead="I don't have channel performance data, so this one needs you to tell me."
      >
        <CandidateGroup
          name="traction_selection"
          customName="custom_traction"
          options={TRACTION_OPTIONS}
          value={traction}
          onChange={setTraction}
          customLabel="Something else"
        />
      </Panel>

      <ContinueButton />
    </form>
  );
}

function Panel({
  header,
  subhead,
  muted,
  children,
}: {
  header: string;
  subhead: string;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">{header}</h2>
        <p className={muted ? "text-sm text-muted-foreground italic" : "text-sm"}>
          {subhead}
        </p>
      </div>
      {children}
    </div>
  );
}

function CandidateGroup({
  name,
  customName,
  options,
  value,
  onChange,
  customLabel,
}: {
  name: string;
  customName: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  customLabel: string;
}) {
  return (
    <div className="space-y-2">
      <RadioGroup name={name} value={value} onValueChange={onChange}>
        {options.map((opt, i) => (
          <div key={i} className="flex items-start gap-2">
            <RadioGroupItem value={opt} id={`${name}-${i}`} className="mt-1" />
            <Label htmlFor={`${name}-${i}`} className="font-normal leading-snug">
              {opt}
            </Label>
          </div>
        ))}
        <div className="flex items-start gap-2">
          <RadioGroupItem
            value="__custom__"
            id={`${name}-custom`}
            className="mt-1"
          />
          <Label
            htmlFor={`${name}-custom`}
            className="font-normal leading-snug"
          >
            {customLabel}
          </Label>
        </div>
      </RadioGroup>
      {value === "__custom__" ? (
        <Input
          name={customName}
          placeholder="Describe in one line..."
          required
        />
      ) : null}
    </div>
  );
}

function ContinueButton() {
  const { pending } = useFormStatus();
  return (
    <div className="flex justify-end">
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving..." : "Continue"}
      </Button>
    </div>
  );
}
