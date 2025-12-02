import React, { useState, useEffect, useCallback } from 'react';
import { User, Role } from '@/types';
import { fetchUsers, updateUser, removeUser, addLog, addUserWithRole } from '@/services/apiService';
import { PlusIcon, TrashIcon, PencilIcon } from '@/components/icons/IconComponents';
import { useTranslation } from '@/i18n';
import ErrorDisplay from '@/components/ErrorDisplay';

interface UserManagementProps {
    user: User;
}

const UserManagement: React.FC<UserManagementProps> = ({ user }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState<{ name: string; email: string; role: Role; password?: string }>({
        name: '',
        email: '',
        role: Role.User,
        password: '',
    });
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { t } = useTranslation();

    const loadUsers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchUsers();
            setUsers(data);
        } catch (e) {
            setError(t('errors.loadData'));
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        // ✅ Normalize role capitalization before sending
        if (name === 'role') {
            const formattedRole = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
            setFormData(prev => ({ ...prev, [name]: formattedRole as Role }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value as Role }));
        }
    };

    const handleEditClick = (userToEdit: User) => {
        setEditingUser(userToEdit);
        setFormData({
            name: userToEdit.name,
            email: userToEdit.email,
            role: userToEdit.role,
        });
        setError(null);
    };

    const handleCancelEdit = () => {
        setEditingUser(null);
        setFormData({ name: '', email: '', role: Role.User, password: '' });
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.email) return;
        setError(null);

        try {
            if (editingUser) {
                await updateUser(editingUser.id, formData.name, formData.role);
                addLog('Update User', `Updated details for user: ${formData.name} (${formData.email})`);
            } else {
                if (!formData.password || formData.password.length < 8) {
                    setError('Password must be at least 8 characters long.');
                    return;
                }

                const newUser = await addUserWithRole(
                    formData.email,
                    formData.password,
                    formData.name,
                    formData.role
                );
                addLog('Add User', `Added new user: ${newUser.name} (${newUser.email})`);
            }
            handleCancelEdit();
            loadUsers();
        } catch (e: any) {
            setError(e.response?.data?.message || e.message || t('errors.saveData'));
            console.error('User save failed:', e.response?.data || e);
        }
    };

    const handleRemove = async (id: string) => {
        if (id === user.id) {
            setError(t('errors.cannotDeleteSelf'));
            return;
        }

        if (window.confirm(t('userManagement.deleteConfirm'))) {
            setError(null);
            try {
                const userToRemove = users.find(u => u.id === id);
                await removeUser(id);
                if (userToRemove) {
                    addLog('Remove User', `Removed app access for user: ${userToRemove.name} (${userToRemove.email})`);
                }
                loadUsers();
            } catch (e) {
                setError(t('errors.actionFailed'));
                console.error(e);
            }
        }
    };

    const roleColor: { [key in Role]: string } = {
        [Role.Admin]: 'text-red-700 bg-red-100',
        [Role.User]: 'text-gray-700 bg-gray-100',
    };

    return (
        <div className="bg-brand-light p-6 rounded-xl shadow-md">
            <h2 className="text-2xl font-bold text-brand-dark mb-6">{t('userManagement.title')}</h2>

            {error && <ErrorDisplay message={error} />}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <h3 className="text-lg font-semibold text-brand-dark mb-4">{t('userManagement.existingUsers')}</h3>
                    {loading ? (
                        <p>{t('userManagement.loading')}</p>
                    ) : (
                        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                            {users.map(item => (
                                <li
                                    key={item.id}
                                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border"
                                >
                                    <div>
                                        <p className="font-bold text-brand-dark">{item.name}</p>
                                        <p className="text-sm text-gray-600">{item.email}</p>
                                        <p className="text-sm text-gray-600">
                                            <span
                                                className={`mt-1 inline-block px-2 py-1 rounded-full text-xs font-medium ${roleColor[item.role]}`}
                                            >
                                                {item.role}
                                            </span>
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleEditClick(item)}
                                            className="p-2 text-blue-500 hover:bg-blue-100 rounded-full transition-colors"
                                            aria-label={t('userManagement.editButton')}
                                        >
                                            <PencilIcon className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleRemove(item.id)}
                                            className="p-2 text-red-500 hover:bg-red-100 rounded-full transition-colors"
                                            aria-label={t('userManagement.deleteButton')}
                                            disabled={item.id === user.id}
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </div>
                    )}
                </div>

                <div>
                    <h3 className="text-lg font-semibold text-brand-dark mb-4">
                        {editingUser ? t('userManagement.editUserTitle') : t('userManagement.addUserTitle')}
                    </h3>
                    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-gray-50">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                                {t('userManagement.nameLabel')}
                            </label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
                                placeholder={t('userManagement.namePlaceholder')}
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                                {t('userManagement.emailLabel')}
                            </label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary disabled:bg-gray-100"
                                placeholder={t('userManagement.emailPlaceholder')}
                                required
                                disabled={!!editingUser}
                            />
                        </div>
                        {!editingUser && (
                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                    Password
                                </label>
                                <input
                                    type="password"
                                    id="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleInputChange}
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
                                    placeholder="Min. 8 characters"
                                    required
                                />
                            </div>
                        )}
                        <div>
                            <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                                {t('userManagement.roleLabel')}
                            </label>
                            <select
                                id="role"
                                name="role"
                                value={formData.role}
                                onChange={handleInputChange}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
                            >
                                {Object.values(Role).map(role => (
                                    <option key={role} value={role}>
                                        {role}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center gap-4">
                            <button
                                type="submit"
                                className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-brand-primary text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75 transition duration-300"
                            >
                                {editingUser ? (
                                    t('userManagement.saveButton')
                                ) : (
                                    <>
                                        <PlusIcon className="w-5 h-5" /> {t('userManagement.addButton')}
                                    </>
                                )}
                            </button>
                            {editingUser && (
                                <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    className="flex-1 py-2 px-4 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                                >
                                    {t('userManagement.cancelButton')}
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default UserManagement;
