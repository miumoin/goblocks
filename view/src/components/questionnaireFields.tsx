import React from 'react';

const QuestionnaireFields: React.FC<{
    questions: string[];
    onChange: (questions: string[]) => void;
    disabled?: boolean;
}> = ({ questions, onChange, disabled }) => {
    // Add an extra empty field if the last field is not empty
    const displayQuestions = questions[questions.length - 1]?.trim() !== '' 
        ? [...questions, ''] 
        : questions;

    return (
        <div className="questionnaire-fields">
            {displayQuestions.map((question, index) => (
                <div className="mb-2" key={index}>
                    <input 
                        type="text"
                        className="form-control"
                        placeholder={`Question ${index + 1} (i.e. Expected salary)`}
                        value={question}
                        onChange={(e) => {
                            const newQuestions = [...questions];
                            newQuestions[index] = e.target.value;
                            
                            // Remove empty fields except one at the end
                            const filteredQuestions = newQuestions.filter((q, i) => 
                                q.trim() !== '' || i === index
                            );
                            
                            onChange(filteredQuestions);
                        }}
                        disabled={disabled}
                    />
                </div>
            ))}
        </div>
    );
};

export default QuestionnaireFields;