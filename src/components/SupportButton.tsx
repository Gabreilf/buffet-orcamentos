import React from 'react';

const SupportButton: React.FC = () => {
    return (
        <a
            href="https://wa.me/5521973741689"
            target="_blank"
            rel="noopener noreferrer"
            className="mb-4 w-full max-w-xs bg-green-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-600 transition duration-300 ease-in-out shadow-lg flex items-center justify-center text-sm"
            title="Suporte via WhatsApp"
        >
            <i className="fab fa-whatsapp mr-2"></i> Falar com Suporte
        </a>
    );
};

export default SupportButton;