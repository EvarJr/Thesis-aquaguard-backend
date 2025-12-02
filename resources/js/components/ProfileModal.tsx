import React, { useState, useEffect } from 'react';
import { User } from '@/types';
import { updateProfile } from '@/services/apiService';
import { XMarkIcon, CheckIcon } from '@/components/icons/IconComponents'; // Assuming you have these icons
import { useTranslation } from '@/i18n';

interface ProfileModalProps {
    user: User;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: (updatedUser: User) => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ user, isOpen, onClose, onUpdate }) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        password_confirmation: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { t } = useTranslation();

    // Load current user data when modal opens
    useEffect(() => {
        if (isOpen && user) {
            setFormData({
                name: user.name,
                email: user.email,
                password: '',
                password_confirmation: ''
            });
            setError(null);
        }
    }, [isOpen, user]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // If password fields are empty, send undefined to skip update
            const updatedUser = await updateProfile(
                formData.name,
                formData.email,
                formData.password || undefined,
                formData.password_confirmation || undefined
            );
            
            // Update local storage and parent state
            localStorage.setItem('user', JSON.stringify(updatedUser));
            onUpdate(updatedUser);
            onClose();
            alert("Profile updated successfully!");
        } catch (err: any) {
            console.error(err);
            // Handle validation errors from Laravel
            if (err.response && err.response.data && err.response.data.errors) {
                const firstError = Object.values(err.response.data.errors)[0];
                setError(String(firstError));
            } else {
                setError("Failed to update profile.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="bg-brand-primary px-6 py-4 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white">Edit Profile</h3>
                    <button onClick={onClose} className="text-white hover:text-gray-200">
                        <span className="text-2xl">&times;</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded text-sm">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Name</label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-brand-primary focus:border-brand-primary"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-brand-primary focus:border-brand-primary"
                            required
                        />
                    </div>

                    <div className="border-t pt-4 mt-2">
                        <p className="text-xs text-gray-500 mb-2">Leave password blank to keep current password.</p>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">New Password</label>
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-brand-primary focus:border-brand-primary"
                            />
                        </div>
                        <div className="mt-3">
                            <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
                            <input
                                type="password"
                                name="password_confirmation"
                                value={formData.password_confirmation}
                                onChange={handleChange}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-brand-primary focus:border-brand-primary"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProfileModal;