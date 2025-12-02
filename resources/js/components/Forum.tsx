import React, { useState, useEffect, useCallback } from 'react';
import { User, Role, ForumCategory, ForumTopic } from '@/types';
import { fetchTopics, fetchTopicById, addTopic, addPost, addLog, updateTopic, deleteTopic } from '@/services/apiService';
import { useTranslation } from '@/i18n';
import { PlusIcon, ChevronLeftIcon, UserCircleIcon, ChatBubbleLeftRightIcon, TrashIcon, PencilSquareIcon } from '@/components/icons/IconComponents';
import ErrorDisplay from '@/components/ErrorDisplay';

interface ForumProps {
    user: User;
}

const Forum: React.FC<ForumProps> = ({ user }) => {
    // State
    const [selectedCategory, setSelectedCategory] = useState<ForumCategory | 'All'>('All');
    const [topics, setTopics] = useState<ForumTopic[]>([]);
    const [selectedTopic, setSelectedTopic] = useState<ForumTopic | null>(null);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'list' | 'topic' | 'form'>('list'); // Changed 'new_topic' to 'form'
    const [error, setError] = useState<string | null>(null);
    
    // Form State (Shared for Create & Edit)
    const [isEditing, setIsEditing] = useState(false);
    const [editTopicId, setEditTopicId] = useState<string | null>(null);
    
    const [formTitle, setFormTitle] = useState('');
    const [formContent, setFormContent] = useState('');
    const [formCategory, setFormCategory] = useState<ForumCategory>(ForumCategory.Community);
    
    const [replyContent, setReplyContent] = useState('');

    const { t } = useTranslation();

    const loadTopics = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const fetchedTopics = await fetchTopics(selectedCategory as any);
            setTopics(fetchedTopics);
        } catch (e) {
            setError(t('errors.loadData'));
        } finally {
            setLoading(false);
        }
    }, [selectedCategory, t]);
    
    useEffect(() => {
        if (view === 'list') loadTopics();
    }, [loadTopics, view]);

    const handleSelectTopic = async (topicId: string) => {
        setLoading(true);
        try {
            const topicDetails = await fetchTopicById(topicId);
            if(topicDetails) {
                setSelectedTopic(topicDetails);
                setView('topic');
            }
        } catch (e) {
            setError(t('errors.loadData'));
        } finally {
            setLoading(false);
        }
    };

    // ✅ PREPARE CREATE
    const openCreateForm = () => {
        setIsEditing(false);
        setEditTopicId(null);
        setFormTitle('');
        setFormContent('');
        setFormCategory(ForumCategory.Community);
        setView('form');
    };

    // ✅ PREPARE EDIT
    const openEditForm = (e: React.MouseEvent, topic: ForumTopic) => {
        e.stopPropagation(); // Prevent opening the topic
        setIsEditing(true);
        setEditTopicId(topic.id);
        setFormTitle(topic.title);
        setFormContent("Editing topic details only. To edit the post content, please delete and repost."); // Simplified for now
        setFormCategory(topic.category as ForumCategory);
        setView('form');
    };

    // ✅ HANDLE SUBMIT (Create or Update)
    const handleSubmitTopic = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formTitle) return;
        setError(null);
        
        try {
            if (isEditing && editTopicId) {
                // Update Logic
                await updateTopic(editTopicId, formTitle, formCategory);
                addLog('Update Topic', `Updated topic "${formTitle}"`);
            } else {
                // Create Logic
                if (!formContent) return;
                await addTopic(formTitle, formContent, formCategory);
                addLog('Create Topic', `Created topic "${formTitle}"`);
            }
            
            setView('list');
            loadTopics();
        } catch (e) {
            setError(t('errors.saveData'));
        }
    };

    // ✅ HANDLE DELETE
    const handleDeleteTopic = async (e: React.MouseEvent, topicId: string) => {
        e.stopPropagation();
        if(!confirm(t('forum.confirmDelete'))) return;

        try {
            await deleteTopic(topicId);
            addLog('Delete Topic', `Deleted topic ${topicId}`);
            loadTopics(); // Refresh list
        } catch (e) {
            setError(t('errors.actionFailed'));
        }
    };
    
    const handlePostReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!replyContent || !selectedTopic) return;
        try {
            await addPost(selectedTopic.id, replyContent);
            setReplyContent('');
            handleSelectTopic(selectedTopic.id);
        } catch (e) {
            setError(t('errors.saveData'));
        }
    };

    const timeSince = (date: string) => {
        const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
        let interval = seconds / 3600;
        if (interval > 1) return `${Math.floor(interval)}h ago`;
        interval = seconds / 60;
        if (interval > 1) return `${Math.floor(interval)}m ago`;
        return `Just now`;
    };

    // --- VIEW: FORM (Create / Edit) ---
    if (view === 'form') {
        return (
            <div className="bg-brand-light p-6 rounded-xl shadow-md max-w-3xl mx-auto">
                <button onClick={() => setView('list')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-brand-primary mb-6">
                    <ChevronLeftIcon className="w-4 h-4" /> {t('forum.backToTopics')}
                </button>
                <h2 className="text-2xl font-bold text-brand-dark mb-6">
                    {isEditing ? t('forum.editTopic') : t('forum.newTopic')}
                </h2>
                {error && <ErrorDisplay message={error} />}
                
                <form onSubmit={handleSubmitTopic} className="space-y-5">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">{t('forum.topicTitle')}</label>
                        <input 
                            type="text" 
                            value={formTitle} 
                            onChange={e => setFormTitle(e.target.value)} 
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                            required 
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Category</label>
                        <select 
                            value={formCategory} 
                            onChange={e => setFormCategory(e.target.value as ForumCategory)} 
                            className="w-full p-3 border border-gray-300 rounded-lg bg-white"
                        >
                            <option value={ForumCategory.Community}>Community Hub</option>
                            <option value={ForumCategory.Announcements}>Announcements</option>
                            {user.role === Role.Admin && <option value={ForumCategory.Admin}>Admin Discussions</option>}
                        </select>
                    </div>

                    {/* Content field only shown on Create (Editing first post is complex, usually separate) */}
                    {!isEditing && (
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">{t('forum.yourMessage')}</label>
                            <textarea 
                                value={formContent} 
                                onChange={e => setFormContent(e.target.value)} 
                                rows={6} 
                                className="w-full p-3 border border-gray-300 rounded-lg resize-none" 
                                required
                            ></textarea>
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button type="submit" className="px-6 py-2 bg-brand-primary text-white font-bold rounded-lg hover:bg-blue-700">
                            {isEditing ? t('forum.saveChanges') : t('forum.createTopic')}
                        </button>
                        <button type="button" onClick={() => setView('list')} className="px-6 py-2 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300">
                            {t('forum.cancel')}
                        </button>
                    </div>
                </form>
            </div>
        );
    }
    
    // --- VIEW: DETAIL ---
    if (view === 'topic' && selectedTopic) {
        return (
            <div className="bg-brand-light p-6 rounded-xl shadow-md h-[calc(100vh-140px)] flex flex-col">
                <div className="flex-none border-b pb-4 mb-4">
                    <button onClick={() => setView('list')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-brand-primary mb-3">
                        <ChevronLeftIcon className="w-4 h-4" /> {t('forum.backToTopics')}
                    </button>
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold text-brand-dark">{selectedTopic.title}</h2>
                            <span className="inline-block mt-1 px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-800 rounded-full uppercase">{selectedTopic.category}</span>
                        </div>
                        <div className="text-right text-sm text-gray-500">
                            <p>Started by <span className="font-semibold text-gray-800">{selectedTopic.authorName}</span></p>
                            <p>{timeSince(selectedTopic.createdAt)}</p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4 custom-scrollbar">
                    {selectedTopic.posts.map(post => (
                        <div key={post.id} className={`flex gap-4 ${post.authorId === user.id ? 'flex-row-reverse' : ''}`}>
                            <div className="flex-shrink-0 mt-1">
                                <UserCircleIcon className="w-8 h-8 text-gray-400" />
                            </div>
                            <div className={`max-w-[80%] p-4 rounded-lg shadow-sm ${post.authorId === user.id ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border border-gray-200 rounded-tl-none'}`}>
                                <div className="flex justify-between items-center mb-1 gap-4">
                                    <span className={`text-xs font-bold ${post.authorId === user.id ? 'text-blue-100' : 'text-gray-600'}`}>{post.authorName}</span>
                                    <span className={`text-[10px] ${post.authorId === user.id ? 'text-blue-200' : 'text-gray-400'}`}>{timeSince(post.createdAt)}</span>
                                </div>
                                <p className="text-sm whitespace-pre-wrap leading-relaxed">{post.content}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex-none border-t pt-4">
                    <form onSubmit={handlePostReply} className="flex gap-2">
                        <input type="text" value={replyContent} onChange={e => setReplyContent(e.target.value)} className="flex-1 p-3 border rounded-lg" placeholder={t('forum.yourReply')} required />
                        <button type="submit" className="px-6 py-2 bg-brand-primary text-white font-bold rounded-lg hover:bg-blue-700">{t('forum.postReply')}</button>
                    </form>
                </div>
            </div>
        )
    }

    // --- VIEW: LIST ---
    return (
        <div className="bg-brand-light p-6 rounded-xl shadow-md">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-brand-dark">{t('forum.title')}</h2>
                <button onClick={openCreateForm} className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white font-bold rounded-lg hover:bg-blue-700 shadow-md">
                    <PlusIcon className="w-5 h-5" /> {t('forum.newTopic')}
                </button>
            </div>

            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {['All', ...Object.values(ForumCategory)].map((cat) => (
                    <button key={cat} onClick={() => setSelectedCategory(cat as any)} className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap ${selectedCategory === cat ? 'bg-brand-primary text-white shadow-md' : 'bg-white text-gray-600 border'}`}>
                        {cat}
                    </button>
                ))}
            </div>
            
            {error && <ErrorDisplay message={error} />}
            
            {loading ? (
                <div className="text-center py-12 text-gray-500">Loading discussions...</div>
            ) : (
                <div className="space-y-3">
                    {topics.length > 0 ? topics.map(topic => {
                        // ✅ CHECK PERMISSIONS: Admin or Author can Edit/Delete
                        const canManage = user.role === Role.Admin || topic.authorId === user.id;

                        return (
                            <div key={topic.id} onClick={() => handleSelectTopic(topic.id)} className="bg-white p-5 rounded-xl border border-gray-200 hover:shadow-md cursor-pointer transition-all group relative">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-bold rounded uppercase">{topic.category}</span>
                                            <span className="text-xs text-gray-500">Posted by <span className="font-bold text-gray-700">{topic.authorName}</span></span>
                                        </div>
                                        <h3 className="text-lg font-bold text-brand-dark group-hover:text-brand-primary transition-colors">{topic.title}</h3>
                                    </div>
                                    
                                    {/* ✅ ACTION BUTTONS */}
                                    <div className="flex items-center gap-3">
                                        {canManage && (
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                <button 
                                                    onClick={(e) => openEditForm(e, topic)} 
                                                    className="p-2 text-blue-500 hover:bg-blue-100 rounded-full"
                                                    title="Edit Topic"
                                                >
                                                    <PencilSquareIcon className="w-5 h-5" />
                                                </button>
                                                <button 
                                                    onClick={(e) => handleDeleteTopic(e, topic.id)} 
                                                    className="p-2 text-red-500 hover:bg-red-100 rounded-full"
                                                    title="Delete Topic"
                                                >
                                                    <TrashIcon className="w-5 h-5" />
                                                </button>
                                            </div>
                                        )}
                                        <div className="flex flex-col items-end text-gray-400 text-xs min-w-[60px]">
                                            <span>{timeSince(topic.createdAt)}</span>
                                            <ChevronLeftIcon className="w-5 h-5 mt-2 text-gray-300 group-hover:text-brand-primary rotate-180" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    }) : (
                        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                            <ChatBubbleLeftRightIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                            <p className="text-gray-500 font-medium">{t('forum.noTopics')}</p>
                            <button onClick={openCreateForm} className="mt-2 text-brand-primary hover:underline text-sm font-bold">Start a conversation</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Forum;