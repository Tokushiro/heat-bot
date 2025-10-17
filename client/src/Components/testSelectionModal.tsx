import React, { useState } from "react";
import { Modal, Form, Input, Radio, Select } from "antd";
import type { FormInstance } from "antd";
import type { SelectProps } from 'antd';

export type TestSelectionValues = {
    testType: "testPattern1" | "testPattern2";
    customTestName: string;
    sensors: string[];
};

type Props = {
    open: boolean;
    onClose: () => void;
    onSubmit: (values: TestSelectionValues, form: FormInstance<TestSelectionValues>) => Promise<void> | void;
    initialValues?: Partial<TestSelectionValues>;
    title?: React.ReactNode;
};


const FORM_ID = "test-selection-modal-form";

const options: SelectProps['options'] = [];

for (let i = 10; i < 36; i++) {
    options.push({
        value: i.toString(36) + i,
        label: i.toString(36) + i,
    });
}

export default function TestSelectionModal({
                                               open,
                                               onClose,
                                               onSubmit,
                                               initialValues,
                                               title = "Select & Configure Test",
                                           }: Props) {
    const [form] = Form.useForm<TestSelectionValues>();
    const [submitting, setSubmitting] = useState(false);

    const handleFinish = async (values: TestSelectionValues) => {
        try {
            setSubmitting(true);
            await onSubmit(values, form);
        } finally {
            setSubmitting(false);
        }
    };



    return (
        <Modal
            open={open}
            title={title}
            onCancel={onClose}
            afterClose={() => form.resetFields()}
            okText="Submit"
            cancelText="Cancel"
            confirmLoading={submitting}
            okButtonProps={{ htmlType: "submit", form: FORM_ID, disabled: submitting }}
            maskClosable={!submitting}
        >
            <Form<TestSelectionValues>
                id={FORM_ID}
                form={form}
                layout="vertical"
                initialValues={initialValues}
                onFinish={handleFinish}
            >
                <Form.Item
                    label="Select Test Type"
                    name="testType"
                    rules={[{ required: true, message: "Please select a test type!" }]}
                >
                    <Radio.Group>
                        <Radio value="testPattern1">Test Pattern 1</Radio>
                        <Radio value="testPattern2">Test Pattern 2</Radio>
                    </Radio.Group>
                </Form.Item>

                <Form.Item
                    label="Custom Test Name"
                    name="customTestName"
                    rules={[{ required: true, message: "Please enter custom test name!" }]}
                >
                    <Input placeholder="Enter custom test name" />
                </Form.Item>

                <Form.Item
                    label="Select Sensor"
                    name="sensors"
                    rules={[{ required: true, message: "Please select at least one sensor!" }]}
                >
                    <Select
                        placeholder="Select sensors to include"
                        options={options}
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
}
