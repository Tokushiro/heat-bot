import { Modal, Form, Input, message} from "antd";
import { useState } from "react";
import type {TestChoice} from "../Types/testChoice.ts";
import axios from "axios";

const FORM_ID = "test-choice-input-modal-form";

type Props = {
    open: boolean;
    onClose: () => void;
    onSubmit: () => void;
};


export default function TestChoiceInputModal({ open, onClose, onSubmit }: Props) {
    const [submitting, setSubmitting] = useState(false);
    const [form] = Form.useForm<TestChoice>();

    const handleSubmit = async (values: TestChoice) => {
        try {
            setSubmitting(true);

            await axios.post("http://localhost:3000/api/testchoice", {
                test_name: values.test_name,
                test_standard: values.test_standard,
                test_method: values.test_method,
                test_lab: values.test_lab,
            });

            message.success("Test choice added successfully");
            onSubmit();
            onClose();
            form.resetFields();
        } catch (err: any) {
            console.error(err);
            message.error(
                err?.response?.data?.message ?? "Failed to add test choice. Please try again."
            );
        } finally {
            setSubmitting(false);
        }
    };



return(
    <Modal
        open={open}
        title="Sensor Input"
        onCancel={onClose}
        afterClose={() => form.resetFields()}
        okText="Submit"
        cancelText="Cancel"
        confirmLoading={submitting}
        okButtonProps={{ htmlType: "submit", form: FORM_ID, disabled: submitting }}
        maskClosable={!submitting}>

        <Form<TestChoice>
            form={form}
            id={FORM_ID}
            layout="vertical"
            onFinish={handleSubmit}>
            <Form.Item
                label="Test Name"
                name="test_name"
                rules={[{ required: true, message: "Please enter the test name!" }]}>
                <Input />
            </Form.Item>

            <Form.Item
                label="Test Standard"
                name="test_standard"
                rules={[{ required: true, message: "Please enter the test standard!" }]}>
                <Input />
            </Form.Item>

            <Form.Item
                label="Test Method"
                name="test_method"
                rules={[{ required: true, message: "Please enter the test method!" }]}>
                <Input />
            </Form.Item>

            <Form.Item
                label="Test Lab"
                name="test_lab"
                rules={[{ required: true, message: "Please enter the test lab!" }]}>
                <Input />
            </Form.Item>
        </Form>
    </Modal>
)
}