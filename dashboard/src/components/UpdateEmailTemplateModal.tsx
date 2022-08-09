import React, { useEffect, useState } from 'react';
import {
	Button,
	Center,
	Flex,
	Input,
	InputGroup,
	MenuItem,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	Select,
	Text,
	useDisclosure,
	useToast,
} from '@chakra-ui/react';
import { FaPlus } from 'react-icons/fa';
import { useClient } from 'urql';
import { Editor } from 'react-draft-wysiwyg';
import { EditorState, convertToRaw, Modifier } from 'draft-js';
import draftToHtml from 'draftjs-to-html';
import { stateFromHTML } from 'draft-js-import-html';
import {
	UpdateModalViews,
	EmailTemplateInputDataFields,
	emailTemplateEventNames,
	emailTemplateVariables,
} from '../constants';
import { capitalizeFirstLetter } from '../utils';
import { AddEmailTemplate, EditEmailTemplate } from '../graphql/mutation';

interface selectedEmailTemplateDataTypes {
	[EmailTemplateInputDataFields.ID]: string;
	[EmailTemplateInputDataFields.EVENT_NAME]: string;
	[EmailTemplateInputDataFields.SUBJECT]: string;
	[EmailTemplateInputDataFields.CREATED_AT]: number;
	[EmailTemplateInputDataFields.TEMPLATE]: string;
}

interface UpdateEmailTemplateInputPropTypes {
	view: UpdateModalViews;
	selectedTemplate?: selectedEmailTemplateDataTypes;
	fetchEmailTemplatesData: Function;
}

interface templateVariableDataTypes {
	text: string;
	value: string;
}

interface emailTemplateDataType {
	[EmailTemplateInputDataFields.EVENT_NAME]: string;
	[EmailTemplateInputDataFields.SUBJECT]: string;
}

interface validatorDataType {
	[EmailTemplateInputDataFields.SUBJECT]: boolean;
}

const initTemplateData: emailTemplateDataType = {
	[EmailTemplateInputDataFields.EVENT_NAME]: emailTemplateEventNames.Signup,
	[EmailTemplateInputDataFields.SUBJECT]: '',
};

const initTemplateValidatorData: validatorDataType = {
	[EmailTemplateInputDataFields.SUBJECT]: true,
};

const UpdateEmailTemplate = ({
	view,
	selectedTemplate,
	fetchEmailTemplatesData,
}: UpdateEmailTemplateInputPropTypes) => {
	const client = useClient();
	const toast = useToast();
	const { isOpen, onOpen, onClose } = useDisclosure();
	const [loading, setLoading] = useState<boolean>(false);
	const [editorState, setEditorState] = React.useState<EditorState>(
		EditorState.createEmpty()
	);
	const [templateVariables, setTemplateVariables] = useState<
		templateVariableDataTypes[]
	>([]);
	const [templateData, setTemplateData] = useState<emailTemplateDataType>({
		...initTemplateData,
	});
	const [validator, setValidator] = useState<validatorDataType>({
		...initTemplateValidatorData,
	});
	const onEditorStateChange = (editorState: EditorState) => {
		setEditorState(editorState);
	};
	const inputChangehandler = (inputType: string, value: any) => {
		if (inputType !== EmailTemplateInputDataFields.EVENT_NAME) {
			setValidator({
				...validator,
				[inputType]: value?.trim().length,
			});
		}
		setTemplateData({ ...templateData, [inputType]: value });
	};

	const validateData = () => {
		const rawData: string = draftToHtml(
			convertToRaw(editorState.getCurrentContent())
		).trim();
		return (
			!loading &&
			rawData &&
			rawData !== '<p></p>' &&
			rawData !== '<h1></h1>' &&
			templateData[EmailTemplateInputDataFields.EVENT_NAME].length > 0 &&
			templateData[EmailTemplateInputDataFields.SUBJECT].length > 0 &&
			validator[EmailTemplateInputDataFields.SUBJECT]
		);
	};

	const saveData = async () => {
		if (!validateData()) return;
		setLoading(true);
		const params = {
			[EmailTemplateInputDataFields.EVENT_NAME]:
				templateData[EmailTemplateInputDataFields.EVENT_NAME],
			[EmailTemplateInputDataFields.SUBJECT]:
				templateData[EmailTemplateInputDataFields.SUBJECT],
			[EmailTemplateInputDataFields.TEMPLATE]: draftToHtml(
				convertToRaw(editorState.getCurrentContent())
			).trim(),
		};
		let res: any = {};
		if (
			view === UpdateModalViews.Edit &&
			selectedTemplate?.[EmailTemplateInputDataFields.ID]
		) {
			res = await client
				.mutation(EditEmailTemplate, {
					params: {
						...params,
						id: selectedTemplate[EmailTemplateInputDataFields.ID],
					},
				})
				.toPromise();
		} else {
			res = await client.mutation(AddEmailTemplate, { params }).toPromise();
		}
		setLoading(false);
		if (res.error) {
			toast({
				title: capitalizeFirstLetter(res.error.message),
				isClosable: true,
				status: 'error',
				position: 'bottom-right',
			});
		} else if (
			res.data?._add_email_template ||
			res.data?._update_email_template
		) {
			toast({
				title: capitalizeFirstLetter(
					res.data?._add_email_template?.message ||
						res.data?._update_email_template?.message
				),
				isClosable: true,
				status: 'success',
				position: 'bottom-right',
			});
			setTemplateData({
				...initTemplateData,
			});
			setValidator({ ...initTemplateValidatorData });
			fetchEmailTemplatesData();
		}
		view === UpdateModalViews.ADD && onClose();
	};
	const resetData = () => {
		if (selectedTemplate) {
			setTemplateData(selectedTemplate);
			setEditorState(
				EditorState.createWithContent(stateFromHTML(selectedTemplate.template))
			);
		} else {
			setTemplateData({ ...initTemplateData });
			setEditorState(EditorState.createEmpty());
		}
	};
	useEffect(() => {
		if (
			isOpen &&
			view === UpdateModalViews.Edit &&
			selectedTemplate &&
			Object.keys(selectedTemplate || {}).length
		) {
			const { id, created_at, template, ...rest } = selectedTemplate;
			setTemplateData(rest);
			setEditorState(EditorState.createWithContent(stateFromHTML(template)));
		}
	}, [isOpen]);
	useEffect(() => {
		const updatedTemplateVariables = Object.entries(
			emailTemplateVariables
		).reduce((acc, varData): any => {
			if (
				(templateData[EmailTemplateInputDataFields.EVENT_NAME] !==
					emailTemplateEventNames['Verify Otp'] &&
					varData[1] === emailTemplateVariables.otp) ||
				(templateData[EmailTemplateInputDataFields.EVENT_NAME] ===
					emailTemplateEventNames['Verify Otp'] &&
					varData[1] === emailTemplateVariables.verification_url)
			) {
				return acc;
			}
			return [
				...acc,
				{
					text: varData[0],
					value: varData[1],
				},
			];
		}, []);
		setTemplateVariables(updatedTemplateVariables);
	}, [templateData[EmailTemplateInputDataFields.EVENT_NAME]]);
	return (
		<>
			{view === UpdateModalViews.ADD ? (
				<Button
					leftIcon={<FaPlus />}
					colorScheme="blue"
					variant="solid"
					onClick={onOpen}
					isDisabled={false}
					size="sm"
				>
					<Center h="100%">Add Template</Center>{' '}
				</Button>
			) : (
				<MenuItem onClick={onOpen}>Edit</MenuItem>
			)}
			<Modal isOpen={isOpen} onClose={onClose} size="3xl">
				<ModalOverlay />
				<ModalContent>
					<ModalHeader>
						{view === UpdateModalViews.ADD
							? 'Add New Email Template'
							: 'Edit Email Template'}
					</ModalHeader>
					<ModalCloseButton />
					<ModalBody>
						<Flex
							flexDirection="column"
							border="1px"
							borderRadius="md"
							borderColor="gray.200"
							p="5"
						>
							<Flex
								width="100%"
								justifyContent="space-between"
								alignItems="center"
								marginBottom="2%"
							>
								<Flex flex="1">Event Name</Flex>
								<Flex flex="3">
									<Select
										size="md"
										value={
											templateData[EmailTemplateInputDataFields.EVENT_NAME]
										}
										onChange={(e) =>
											inputChangehandler(
												EmailTemplateInputDataFields.EVENT_NAME,
												e.currentTarget.value
											)
										}
									>
										{Object.entries(emailTemplateEventNames).map(
											([key, value]: any) => (
												<option value={value} key={key}>
													{key}
												</option>
											)
										)}
									</Select>
								</Flex>
							</Flex>
							<Flex
								width="100%"
								justifyContent="start"
								alignItems="center"
								marginBottom="5%"
							>
								<Flex flex="1">Subject</Flex>
								<Flex flex="3">
									<InputGroup size="md">
										<Input
											pr="4.5rem"
											type="text"
											placeholder="Subject Line"
											value={templateData[EmailTemplateInputDataFields.SUBJECT]}
											isInvalid={
												!validator[EmailTemplateInputDataFields.SUBJECT]
											}
											onChange={(e) =>
												inputChangehandler(
													EmailTemplateInputDataFields.SUBJECT,
													e.currentTarget.value
												)
											}
										/>
									</InputGroup>
								</Flex>
							</Flex>
							<Flex
								width="100%"
								justifyContent="space-between"
								alignItems="center"
								marginBottom="2%"
							>
								<Flex>Template Body</Flex>
								<Text
									style={{
										fontSize: 14,
									}}
									color="gray.400"
								>{`To select dynamic variables open curly braces "{"`}</Text>
							</Flex>
							<Editor
								editorState={editorState}
								onEditorStateChange={onEditorStateChange}
								editorStyle={{
									border: '1px solid #d9d9d9',
									borderRadius: '5px',
									marginTop: '2%',
									height: '35vh',
								}}
								mention={{
									separator: ' ',
									trigger: '{',
									suggestions: templateVariables,
								}}
							/>
						</Flex>
					</ModalBody>
					<ModalFooter>
						<Button
							variant="outline"
							onClick={resetData}
							isDisabled={loading}
							marginRight="5"
						>
							Reset
						</Button>
						<Button
							colorScheme="blue"
							variant="solid"
							isLoading={loading}
							onClick={saveData}
							isDisabled={!validateData()}
						>
							<Center h="100%" pt="5%">
								Save
							</Center>
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
		</>
	);
};

export default UpdateEmailTemplate;