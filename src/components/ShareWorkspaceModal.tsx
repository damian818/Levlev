import React, { useState } from 'react';
import { SharedMember } from '../types';
import { 
  X, 
  Users, 
  UserPlus, 
  Mail, 
  ShieldCheck, 
  Check, 
  Copy, 
  Trash2, 
  Share2, 
  Globe, 
  Lock, 
  AlertCircle, 
  Send, 
  Clock, 
  CheckCircle2, 
  UserCheck, 
  Eye, 
  Edit3, 
  Crown, 
  Layers,
  Sparkles
} from 'lucide-react';

interface ShareWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  isWorkspaceShared: boolean;
  workspaceMembers: SharedMember[];
  onUpdateWorkspaceSharing: (isShared: boolean, members: SharedMember[]) => void;
  workspaceName?: string;
}

export function ShareWorkspaceModal({
  isOpen,
  onClose,
  isWorkspaceShared,
  workspaceMembers,
  onUpdateWorkspaceSharing,
  workspaceName = 'LevLev Household Workspace',
}: ShareWorkspaceModalProps) {
  if (!isOpen) return null;

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'EDITOR' | 'VIEWER' | 'ADMIN'>('EDITOR');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Generate a unique workspace invite code
  const workspaceCode = `LEV-GENERAL-${Math.abs(workspaceName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 8999 + 1000)}`;
  const shareLink = `${window.location.origin}/join?workspace=${encodeURIComponent(workspaceName)}&code=${workspaceCode}`;

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      setErrorMsg('Please enter a valid email format (e.g. partner@example.com).');
      return;
    }

    if (workspaceMembers.some(m => m.email.toLowerCase() === trimmedEmail)) {
      setErrorMsg('This person is already a member or has a pending invitation to this workspace.');
      return;
    }

    const newMember: SharedMember = {
      id: `ws_mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      email: trimmedEmail,
      name: name.trim() || undefined,
      role,
      addedAt: new Date().toISOString().substring(0, 10),
      status: 'PENDING',
    };

    const updatedMembers = [...workspaceMembers, newMember];
    onUpdateWorkspaceSharing(true, updatedMembers);

    setEmail('');
    setName('');
    setSuccessMsg(`General workspace invite sent to ${trimmedEmail}!`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleRemoveMember = (memberId: string) => {
    const updatedMembers = workspaceMembers.filter(m => m.id !== memberId);
    const newIsShared = updatedMembers.length > 0;
    onUpdateWorkspaceSharing(newIsShared, updatedMembers);
  };

  const handleChangeRole = (memberId: string, newRole: 'EDITOR' | 'VIEWER' | 'ADMIN') => {
    const updatedMembers = workspaceMembers.map(m => m.id === memberId ? { ...m, role: newRole } : m);
    onUpdateWorkspaceSharing(true, updatedMembers);
  };

  const handleToggleSharing = (enabled: boolean) => {
    onUpdateWorkspaceSharing(enabled, enabled ? workspaceMembers : []);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(workspaceCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-[#121620] border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800/80 bg-[#161b22] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>General Workspace Sharing</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold uppercase flex items-center gap-1">
                  <Layers className="w-3 h-3" /> Full Data
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Grant another user full access to operate on the same transactions, accounts, budgets, and AI reports.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs">

          {/* Quick Sharing Status Banner */}
          <div className="p-4 rounded-xl bg-[#161b22] border border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-2.5 rounded-xl border ${isWorkspaceShared ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-slate-100 text-sm block">
                  {isWorkspaceShared ? 'Shared Workspace Active' : 'Private Workspace'}
                </span>
                <span className="text-xs text-slate-400 block mt-0.5">
                  {isWorkspaceShared 
                    ? `${workspaceMembers.length} active collaborator(s) working on full dataset` 
                    : 'Only visible & accessible to your personal account'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleToggleSharing(!isWorkspaceShared)}
              className={`px-3.5 py-2 rounded-xl font-bold text-xs transition-colors border ${
                isWorkspaceShared 
                  ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 hover:bg-purple-500/30' 
                  : 'bg-emerald-600 border-emerald-500 text-white hover:bg-emerald-500'
              }`}
            >
              {isWorkspaceShared ? 'Shared' : 'Enable General Share'}
            </button>
          </div>

          {/* Alerts */}
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Invite Member Form */}
          <form onSubmit={handleAddMember} className="space-y-3 bg-[#161b22] p-4 rounded-xl border border-slate-800">
            <h4 className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
              <UserPlus className="w-4 h-4 text-emerald-400" />
              <span>Invite Person to Full Workspace</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Email Address *</label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                  <input
                    type="email"
                    required
                    placeholder="partner@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#0f131a] border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Name / Relationship (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Spouse / Accountant"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#0f131a] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Workspace Access Role</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('EDITOR')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    role === 'EDITOR' 
                      ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300' 
                      : 'bg-[#0f131a] border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold text-[11px] flex items-center gap-1">
                    <Edit3 className="w-3.5 h-3.5 text-emerald-400" /> Full Editor
                  </div>
                  <div className="text-[9px] text-slate-400 mt-1 leading-tight">Can add, edit & operate on all data</div>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('VIEWER')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    role === 'VIEWER' 
                      ? 'bg-purple-500/10 border-purple-500/50 text-purple-300' 
                      : 'bg-[#0f131a] border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold text-[11px] flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5 text-purple-400" /> Read-Only
                  </div>
                  <div className="text-[9px] text-slate-400 mt-1 leading-tight">Can view all reports & transactions</div>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('ADMIN')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    role === 'ADMIN' 
                      ? 'bg-amber-500/10 border-amber-500/50 text-amber-300' 
                      : 'bg-[#0f131a] border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold text-[11px] flex items-center gap-1">
                    <Crown className="w-3.5 h-3.5 text-amber-400" /> Co-Owner
                  </div>
                  <div className="text-[9px] text-slate-400 mt-1 leading-tight">Full admin control & permissions</div>
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send General Workspace Invitation</span>
            </button>
          </form>

          {/* Members List */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-300 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-purple-400" />
                <span>Workspace Collaborators ({workspaceMembers.length})</span>
              </span>
            </h4>

            {workspaceMembers.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-800 bg-[#161b22] text-center text-slate-500">
                No collaborators joined yet. Enter an email above to share access to the entire dataset.
              </div>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {workspaceMembers.map((m) => {
                  const initials = (m.name || m.email).slice(0, 2).toUpperCase();
                  return (
                    <div 
                      key={m.id}
                      className="p-3 rounded-xl bg-[#161b22] border border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 font-bold flex items-center justify-center text-xs shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-200 truncate leading-tight">
                            {m.name ? `${m.name} (${m.email})` : m.email}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                            <span className="flex items-center gap-0.5 text-amber-400">
                              <Clock className="w-2.5 h-2.5" /> Pending Confirmation
                            </span>
                            <span>•</span>
                            <span>Added {m.addedAt}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <select
                          value={m.role}
                          onChange={(e) => handleChangeRole(m.id, e.target.value as any)}
                          className="bg-[#0f131a] border border-slate-700 rounded-md px-2 py-1 text-[10px] text-slate-300 font-medium focus:outline-hidden"
                        >
                          <option value="EDITOR">Full Editor</option>
                          <option value="VIEWER">Read-Only</option>
                          <option value="ADMIN">Co-Owner</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => handleRemoveMember(m.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition-colors rounded"
                          title="Revoke workspace access"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Passcode & Direct Join Link */}
          <div className="bg-[#161b22] p-4 rounded-xl border border-slate-800 space-y-3">
            <h4 className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
              <Share2 className="w-3.5 h-3.5 text-purple-400" />
              <span>General Workspace Invite Link & Passcode</span>
            </h4>

            <div className="space-y-2">
              <div className="flex items-center justify-between bg-[#0f131a] border border-slate-800 rounded-lg p-2 font-mono text-xs text-slate-300">
                <span className="truncate pr-2">{shareLink}</span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-2.5 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded font-sans font-bold text-[10px] shrink-0 flex items-center gap-1 transition-colors"
                >
                  {copiedLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedLink ? 'Copied Link' : 'Copy Link'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between bg-[#0f131a] border border-slate-800 rounded-lg p-2 font-mono text-xs text-slate-300">
                <span>Passcode: <strong className="text-emerald-400 font-bold">{workspaceCode}</strong></span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-sans font-bold text-[10px] shrink-0 flex items-center gap-1 transition-colors"
                >
                  {copiedCode ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCode ? 'Copied' : 'Copy Passcode'}</span>
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-[#161b22] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg text-xs transition-colors"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
