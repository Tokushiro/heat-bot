import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Form, Input,  Select, message, Spin } from "antd";
import type { FormInstance } from "antd";
import type { SelectProps } from "antd";
import SensorInputModal from "./sensorInputModal.tsx";
import TestChoiceInputModal from "./testChoiceImputModal.tsx";
import axios from "axios";
import type { Sensor } from "../Types/sensor.ts";
import type { TestChoice } from "../Types/testChoice.ts";
import type {Test} from "../Types/test.ts"


export type TestSelectionValues = {
    customTestName: string;
    sensors: number;
};

type Props = {
    open: boolean;
    onClose: () => void;
    onSubmit: (values: Test, form: FormInstance<Test>) => Promise<void> | void;
    initialValues?: Partial<Test>;
    title?: React.ReactNode;
};

const FORM_ID = "test-selection-modal-form";

export default function TestSelectionModal({
                                               open,
                                               onClose,
                                               onSubmit,
                                               initialValues,
                                               title = "Select & Configure Test",
                                           }: Props) {
    const [form] = Form.useForm<Test>();
    const [submitting, setSubmitting] = useState(false);

    const [options, setOptions] = useState<SelectProps["options"]>([]);
    const [loadingOptions, setLoadingOptions] = useState(false);
    const [choiceOptions, setChoiceOptions] = useState<SelectProps["options"]>([]);

    const [openSensor, setOpenSensor] = useState(false);
    const [openTestChoice, setOpenTestChoice] = useState(false);

    const baseURL = useMemo(() => "http://localhost:3000", []);

    const fetchSensors = useCallback(async (signal?: AbortSignal) => {
        try {
            setLoadingOptions(true);
            const res = await axios.get<Sensor[]>(`${baseURL}/api/sensors`, { signal });
            const opts: NonNullable<SelectProps["options"]> = res.data.map((s) => ({
                value: Number(s.sensor_id),
                label: s.sensor_name,
            }));
            setOptions(opts);
        } catch (err: unknown) {
            if (axios.isCancel(err)) return;
            console.error("Error fetching sensors:", err);
            message.error("Failed to load sensors.");
        } finally {
            setLoadingOptions(false);
        }
    }, [baseURL]);

    const fetchTests = useCallback(async (signal?: AbortSignal) => {
        try {
            setLoadingOptions(true);
            const res = await axios.get<TestChoice[]>(`${baseURL}/api/testchoice`, { signal });
            const opts: NonNullable<SelectProps["options"]> = res.data.map((s) => ({
                value: Number(s.test_id),
                label: `${s.test_name} - ${s.test_standard} - ${s.test_method} - ${s.test_lab}`,
            }));
            setChoiceOptions(opts);
        } catch (err: unknown) {
            if (axios.isCancel(err)) return;
            console.error("Error fetching tests:", err);
            message.error("Failed to load tests.");
        } finally {
            setLoadingOptions(false);
        }
    }, [baseURL]);

    useEffect(() => {
        if (!open) return;
        const controller = new AbortController();
        fetchSensors(controller.signal);
        fetchTests(controller.signal);
        return () => controller.abort();
    }, [open, fetchSensors, fetchTests]);

    const handleFinish = async (values: Test) => {
        try {
            const time = new Date(Date.now()+(1000*60*(-(new Date()).getTimezoneOffset()))).toISOString().replace('T',' ').replace('Z','');
            setSubmitting(true);
            await axios.post(`${baseURL}/api/test`, {
                test_name: values.test_name,
                test_choice: values.test_choice,
                sensor_id: values.sensor_id,
                test_date: time
            })
            await onSubmit(values, form);
        }
        catch (err: any) {
            console.error(err);
        }
        finally {
            setSubmitting(false);
        }
    };

    const handleAfterClose = () => {
        form.resetFields();
    };

    return (
        <>
            <SensorInputModal
                open={openSensor}
                onClose={() => setOpenSensor(false)}
                onSubmit={async () => {
                    setOpenSensor(false);
                    await fetchSensors();
                }}
            />
            <TestChoiceInputModal
                open={openTestChoice}
                onClose={() => setOpenTestChoice(false)}
                onSubmit={async () => {
                    setOpenTestChoice(false);
                    await fetchTests();
                }}
            />

            <Modal
                open={open}
                title={title}
                onCancel={onClose}
                afterClose={handleAfterClose}
                okText="Submit"
                cancelText="Cancel"
                confirmLoading={submitting}
                okButtonProps={{ htmlType: "submit", form: FORM_ID, disabled: submitting }}
                maskClosable={!submitting}
            >
                <Form<Test>
                    id={FORM_ID}
                    form={form}
                    layout="vertical"
                    initialValues={initialValues}
                    onFinish={handleFinish}
                >
                    <Form.Item
                        label="Custom Test Name"
                        name="test_name"
                        rules={[{ required: true, message: "Please enter custom test name!" }]}
                    >
                        <Input placeholder="Enter custom test name" />
                    </Form.Item>

                    <Form.Item
                        label="Select Test"
                        name="test_choice"
                        rules={[{ required: true, message: "Please select one test" }]}
                    >
                        <Select
                            placeholder="Select tests to include"
                            options={choiceOptions}
                            loading={loadingOptions}
                            notFoundContent={loadingOptions ? <Spin size="small" /> : null}
                            dropdownRender={(menu) => (
                                <>
                                    {menu}
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "center",
                                            padding: 8,
                                            borderTop: "1px solid #f0f0f0",
                                        }}
                                    >
                                        <a
                                            onClick={() => setOpenTestChoice(true)}
                                            style={{ color: "#1677ff", fontWeight: 500, cursor: "pointer" }}
                                        >
                                            + Add new test details
                                        </a>
                                    </div>
                                </>
                            )}
                        />
                    </Form.Item>

                    <Form.Item
                        label="Select Sensor"
                        name="sensor_id"
                        rules={[{ required: true, message: "Please select at least one sensor!" }]}
                    >
                        <Select
                            placeholder="Select sensors to include"
                            options={options}
                            loading={loadingOptions}
                            notFoundContent={loadingOptions ? <Spin size="small" /> : null}
                            dropdownRender={(menu) => (
                                <>
                                    {menu}
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "center",
                                            padding: 8,
                                            borderTop: "1px solid #f0f0f0",
                                        }}
                                    >
                                        <a
                                            onClick={() => setOpenSensor(true)}
                                            style={{ color: "#1677ff", fontWeight: 500, cursor: "pointer" }}
                                        >
                                            + Add new sensor
                                        </a>
                                    </div>
                                </>
                            )}
                        />
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
}
