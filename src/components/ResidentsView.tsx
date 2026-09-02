import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CreditCard,
  FileText,
  Share2,
  Edit2,
  Clock,
  ShieldCheck,
  X,
  AlertCircle,
  CheckCircle2,
  UserX,
  UserCheck,
  Eye,
  Plus,
  ZoomIn,
  Download,
  Image as ImageIcon,
  Building,
  RotateCcw,
} from 'lucide-react';
import { usePG } from '../context/PGContext';
import { Resident, ResidentStatus, SharingType } from '../types';
import { formatCurrency, formatDate, calculateStayDuration } from '../utils/helpers';
import { SensitiveEditModal } from './SensitiveEditModal';
import { ShareDetailsModal } from './ShareDetailsModal';
import { AadhaarDocumentViewerModal } from './AadhaarDocumentViewerModal';
import { Avatar } from './Avatar';

interface ResidentsViewProps {
  onOpenInviteModal: () => void;
  onOpenPaymentModalForResident: (residentId: string) => void;
}

export const ResidentsView: React.FC<ResidentsViewProps> = ({
  onOpenInviteModal,
  onOpenPaymentModalForResident,
}) => {
  const {
    residents,
    payments,
    rooms,
    updateResident,
    changeResidentStatus,
    unvacateResident,
    selectedResidentId,
    setSelectedResidentId,
  } = usePG();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusTab, setStatusTab] = useState<ResidentStatus | 'ALL'>('ACTIVE');

  // Detail drawer / modal
  const activeResident = residents.find((r) => r.id === selectedResidentId) || null;

  // Unvacate modal state
  const [unvacatingResident, setUnvacatingResident] = useState<Resident | null>(null);
  const [unvacateRoomId, setUnvacateRoomId] = useState<string>('');
  const [unvacateBedId, setUnvacateBedId] = useState<string>('');
  const [unvacateSuccessMsg, setUnvacateSuccessMsg] = useState<string>('');

  // Sensitive edit modal state
  const [showSensitiveModal, setShowSensitiveModal] = useState<boolean>(false);
  const [isEditingResident, setIsEditingResident] = useState<boolean>(false);
  const [editFormData, setEditFormData] = useState<Partial<Resident>>({});

  // Share details modal
  const [sharingResident, setSharingResident] = useState<Resident | null>(null);

  // Photo Zoom Modal
  const [zoomedPhoto, setZoomedPhoto] = useState<{ url?: string; name: string } | null>(null);

  // Aadhaar Document Viewer Modal
  const [viewingAadhaarResident, setViewingAadhaarResident] = useState<Resident | null>(null);

  const handleOpenUnvacate = (res: Resident) => {
    setUnvacatingResident(res);
    // Try to find previous room or first room with available beds
    const prevRoom = rooms.find((r) => r.id === res.roomId);
    const prevBed = prevRoom?.beds.find((b) => b.id === res.bedId && b.status === 'Available');

    if (prevRoom && prevBed) {
      setUnvacateRoomId(prevRoom.id);
      setUnvacateBedId(prevBed.id);
    } else {
      const firstAvailRoom = rooms.find((r) => r.beds.some((b) => b.status === 'Available')) || rooms[0];
      const firstAvailBed = firstAvailRoom?.beds.find((b) => b.status === 'Available') || firstAvailRoom?.beds[0];
      setUnvacateRoomId(firstAvailRoom?.id || '');
      setUnvacateBedId(firstAvailBed?.id || '');
    }
  };

  const handleConfirmUnvacate = () => {
    if (!unvacatingResident || !unvacateRoomId || !unvacateBedId) return;
    const success = unvacateResident(unvacatingResident.id, {
      roomId: unvacateRoomId,
      bedId: unvacateBedId,
    });
    if (success) {
      setUnvacateSuccessMsg(`Tenant ${unvacatingResident.fullName} is now reactivated to ACTIVE.`);
      setUnvacatingResident(null);
      setTimeout(() => setUnvacateSuccessMsg(''), 4000);
    }
  };

  // Filtered residents list
  const filteredResidents = residents.filter((r) => {
    if (statusTab !== 'ALL' && r.status !== statusTab) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.fullName.toLowerCase().includes(q) ||
        r.roomNumber.toLowerCase().includes(q) ||
        r.bedNumber.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        r.mobile.includes(q) ||
        r.email.toLowerCase().includes(q)
      );
    }
    return true;
  });

  useEffect(() => {
    setIsEditingResident(false);
  }, [selectedResidentId]);

  const handleStartEdit = () => {
    if (!activeResident) return;
    setEditFormData({
      fullName: activeResident.fullName,
      mobile: activeResident.mobile,
      email: activeResident.email,
      roomId: activeResident.roomId,
      roomNumber: activeResident.roomNumber,
      bedId: activeResident.bedId,
      bedNumber: activeResident.bedNumber,
      sharingType: activeResident.sharingType,
      monthlyRent: activeResident.monthlyRent,
      securityDeposit: activeResident.securityDeposit,
      occupation: activeResident.occupation,
      permanentAddress: activeResident.permanentAddress,
      moveInDate: activeResident.moveInDate || '',
      aadharNumberMasked: activeResident.aadharNumberMasked || '',
      emergencyContact: activeResident.emergencyContact ? { ...activeResident.emergencyContact } : { name: '', phone: '', relationship: 'Guardian' },
    });
    setShowSensitiveModal(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeResident) return;
    updateResident(activeResident.id, editFormData);
    setIsEditingResident(false);
  };

  // When room is changed during edit, update available beds
  const selectedRoomForEdit = rooms.find((r) => r.id === editFormData.roomId);
  const availableBedsForEdit = selectedRoomForEdit
    ? selectedRoomForEdit.beds.filter(
        (b) => b.status === 'Available' || b.id === activeResident?.bedId
      )
    : [];

  return (
    <div id="residents-view-container" className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Residents Directory
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Active tenants, stay duration & payment history
          </p>
        </div>

        <button
          id="residents-invite-btn"
          onClick={onOpenInviteModal}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs shadow-sm transition flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>+ Invite New Tenant</span>
        </button>
      </div>

      {/* Tabs & Search Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl max-w-md">
          <button
            onClick={() => setStatusTab('ACTIVE')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition ${
              statusTab === 'ACTIVE'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Active ({residents.filter((r) => r.status === 'ACTIVE').length})
          </button>
          <button
            onClick={() => setStatusTab('NOTICE')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition ${
              statusTab === 'NOTICE'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            On Notice ({residents.filter((r) => r.status === 'NOTICE').length})
          </button>
          <button
            onClick={() => setStatusTab('VACATED')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition ${
              statusTab === 'VACATED'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Vacated ({residents.filter((r) => r.status === 'VACATED').length})
          </button>
          <button
            onClick={() => setStatusTab('ALL')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition ${
              statusTab === 'ALL'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            All ({residents.length})
          </button>
        </div>

        {/* Search input */}
        <div className="relative flex-1 max-w-xs">
          <input
            id="resident-search-input"
            type="text"
            placeholder="Search name, room, mobile, ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>
      </div>

      {/* Residents Grid */}
      {filteredResidents.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800 mb-1">No Residents Found</h3>
          <p className="text-xs text-slate-500">Try adjusting your search or tab filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredResidents.map((res) => {
            const stayDuration = calculateStayDuration(res.moveInDate);
            const resPayments = payments.filter(
              (p) => p.residentId === res.id && p.billingMonth === 'August 2026' && p.paymentType === 'Rent'
            );
            const paid = resPayments.reduce((sum, p) => sum + p.amountPaid, 0);
            const due = Math.max(0, res.monthlyRent - paid);

            return (
              <div
                key={res.id}
                id={`resident-card-${res.id}`}
                onClick={() => setSelectedResidentId(res.id)}
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition cursor-pointer flex flex-col justify-between"
              >
                <div>
                  {/* Top info */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setZoomedPhoto({ url: res.photoUrl, name: res.fullName });
                        }}
                        className="group relative cursor-pointer"
                        title="Click to zoom resident photo"
                      >
                        <Avatar
                          src={res.photoUrl}
                          name={res.fullName}
                          size="md"
                        />
                        <div className="absolute inset-0 bg-black/30 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                          <ZoomIn className="w-3.5 h-3.5 text-white" />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-bold text-slate-900">{res.fullName}</h3>
                          <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            {res.id}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate max-w-[170px]">{res.occupation}</p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                        res.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : res.status === 'NOTICE'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {res.status}
                    </span>
                  </div>

                  {/* Room, Bed & Rent */}
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 mb-3 text-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-slate-500">Room & Bed</span>
                      <span className="font-bold text-slate-800">
                        Room {res.roomNumber} • Bed {res.bedNumber} ({res.sharingType})
                      </span>
                    </div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-slate-500">Monthly Rent</span>
                      <span className="font-semibold text-slate-800">
                        {formatCurrency(res.monthlyRent)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Current Due (Aug)</span>
                      <span
                        className={`font-bold ${
                          due === 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {due === 0 ? '✓ Cleared' : `${formatCurrency(due)} Due`}
                      </span>
                    </div>
                  </div>

                  {/* Stay info */}
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-2">
                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                    <span>
                      Stay: <strong className="text-slate-700">{stayDuration}</strong> (Joined{' '}
                      {formatDate(res.moveInDate)})
                    </span>
                  </div>
                </div>

                {/* Card footer actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewingAadhaarResident(res);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition"
                  >
                    <FileText className="w-3 h-3" />
                    <span>Aadhaar</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {res.status === 'VACATED' ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenUnvacate(res);
                        }}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold rounded-lg text-[11px] transition flex items-center gap-1 border border-emerald-200"
                        title="Unvacate / Reactivate Tenant"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Unvacate</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenPaymentModalForResident(res.id);
                        }}
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-lg text-[11px] transition"
                      >
                        + Payment
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedResidentId(res.id);
                      }}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-[11px] transition flex items-center gap-1"
                      title="View Details"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      <span>View</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSharingResident(res);
                      }}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                      title="Share WhatsApp details"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Resident Detail Modal / Drawer */}
      {activeResident && (
        <div
          id="resident-detail-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in"
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 relative max-h-[92vh] flex flex-col">
            <button
              onClick={() => {
                setSelectedResidentId(null);
                setIsEditingResident(false);
              }}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Profile Header */}
            <div className="flex items-start gap-4 pb-4 border-b border-slate-100">
              <div
                onClick={() => setZoomedPhoto({ url: activeResident.photoUrl, name: activeResident.fullName })}
                className="group relative cursor-pointer flex-shrink-0"
                title="Click to view full photo"
              >
                <Avatar
                  src={activeResident.photoUrl}
                  name={activeResident.fullName}
                  size="xl"
                  rounded="rounded-2xl"
                  className="border-2 border-indigo-100"
                />
                <div className="absolute inset-0 bg-black/35 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                  <ZoomIn className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold text-slate-900">{activeResident.fullName}</h3>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200">
                    {activeResident.id}
                  </span>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                      activeResident.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700'
                        : activeResident.status === 'NOTICE'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {activeResident.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{activeResident.occupation}</p>
                <div className="flex items-center gap-3 text-xs text-slate-600 mt-2 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> {activeResident.mobile}
                  </span>
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400" /> {activeResident.email}
                  </span>
                </div>
              </div>

              {/* Edit Details Button (Passcode 6565 Protected) */}
              <button
                id="edit-resident-details-btn"
                onClick={handleStartEdit}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition flex items-center gap-1 flex-shrink-0"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Details</span>
              </button>
            </div>

            {/* Modal Body / Tabs Content */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
              {isEditingResident ? (
                /* Edit Form (Unlocked by Passcode) */
                <form onSubmit={handleSaveEdit} className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="font-bold text-slate-800">Edit Resident Information & Bed Reallocation</span>
                    <span className="text-[11px] text-emerald-600 font-medium">✓ Authorized</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">Full Name</label>
                      <input
                        value={editFormData.fullName || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">Mobile Number</label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={10}
                        placeholder="10-digit mobile"
                        value={editFormData.mobile || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                        onKeyDown={(e) => {
                          if (
                            ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(e.key) ||
                            (e.ctrlKey || e.metaKey)
                          ) return;
                          if (!/^[0-9]$/.test(e.key)) e.preventDefault();
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* Room & Bed Reallocation */}
                  <div className="grid grid-cols-2 gap-3 bg-indigo-50/60 p-3 rounded-xl border border-indigo-100">
                    <div>
                      <label className="block text-[11px] font-semibold text-indigo-900 mb-1">
                        Allocated Room
                      </label>
                      <select
                        value={editFormData.roomId || ''}
                        onChange={(e) => {
                          const newRoomId = e.target.value;
                          const targetR = rooms.find((r) => r.id === newRoomId);
                          if (targetR) {
                            const firstAvailableBed = targetR.beds.find((b) => b.status === 'Available') || targetR.beds[0];
                            setEditFormData({
                              ...editFormData,
                              roomId: targetR.id,
                              roomNumber: targetR.roomNumber,
                              buildingId: targetR.buildingId,
                              bedId: firstAvailableBed?.id,
                              bedNumber: firstAvailableBed?.bedNumber,
                              sharingType: targetR.sharingType,
                            });
                          }
                        }}
                        className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-xs font-medium text-slate-800"
                      >
                        {rooms.map((rm) => (
                          <option key={rm.id} value={rm.id}>
                            Room {rm.roomNumber} ({rm.sharingType} - {rm.beds.filter((b) => b.status === 'Available').length} vacant)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-indigo-900 mb-1">
                        Allocated Bed
                      </label>
                      <select
                        value={editFormData.bedId || ''}
                        onChange={(e) => {
                          const newBedId = e.target.value;
                          const targetBed = selectedRoomForEdit?.beds.find((b) => b.id === newBedId);
                          if (targetBed) {
                            setEditFormData({
                              ...editFormData,
                              bedId: targetBed.id,
                              bedNumber: targetBed.bedNumber,
                            });
                          }
                        }}
                        className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-xs font-medium text-slate-800"
                      >
                        {availableBedsForEdit.map((bd) => (
                          <option key={bd.id} value={bd.id}>
                            Bed {bd.bedNumber} ({bd.id === activeResident?.bedId ? 'Current Bed' : bd.status})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">Email / Gmail</label>
                      <input
                        value={editFormData.email || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">Occupation</label>
                      <input
                        value={editFormData.occupation || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, occupation: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  {/* Move-in Date & Aadhaar Number */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">Move-in / Joining Date</label>
                      <input
                        type="date"
                        value={editFormData.moveInDate || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, moveInDate: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">Aadhaar Number</label>
                      <input
                        type="text"
                        placeholder="e.g. XXXX-XXXX-4321"
                        value={editFormData.aadharNumberMasked || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, aadharNumberMasked: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* Emergency Contact */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">Emergency Contact Name</label>
                      <input
                        value={editFormData.emergencyContact?.name || ''}
                        onChange={(e) => setEditFormData({
                          ...editFormData,
                          emergencyContact: {
                            name: e.target.value,
                            phone: editFormData.emergencyContact?.phone || '',
                            relationship: editFormData.emergencyContact?.relationship || 'Guardian'
                          }
                        })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">Emergency Contact Phone</label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="10-digit phone"
                        value={editFormData.emergencyContact?.phone || ''}
                        onChange={(e) => setEditFormData({
                          ...editFormData,
                          emergencyContact: {
                            name: editFormData.emergencyContact?.name || '',
                            phone: e.target.value.replace(/\D/g, '').slice(0, 10),
                            relationship: editFormData.emergencyContact?.relationship || 'Guardian'
                          }
                        })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">Monthly Rent (₹)</label>
                      <input
                        type="number"
                        value={editFormData.monthlyRent === undefined || editFormData.monthlyRent === 0 ? '' : editFormData.monthlyRent}
                        onChange={(e) => setEditFormData({ ...editFormData, monthlyRent: e.target.value === '' ? ('' as any) : Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">Security Deposit (₹)</label>
                      <input
                        type="number"
                        value={editFormData.securityDeposit === undefined || editFormData.securityDeposit === 0 ? '' : editFormData.securityDeposit}
                        onChange={(e) => setEditFormData({ ...editFormData, securityDeposit: e.target.value === '' ? ('' as any) : Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">Permanent Address</label>
                    <textarea
                      rows={2}
                      value={editFormData.permanentAddress || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, permanentAddress: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingResident(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg shadow-xs"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              ) : null}

              {/* Allocation & Stay Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                    Room & Fee Configuration
                  </span>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Room Number:</span>
                      <strong className="text-slate-800">Room {activeResident.roomNumber}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Bed Number:</span>
                      <strong className="text-slate-800">
                        Bed {activeResident.bedNumber} ({activeResident.sharingType})
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Monthly Rent:</span>
                      <strong className="text-indigo-700 font-bold">
                        {formatCurrency(activeResident.monthlyRent)}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Security Deposit:</span>
                      <strong className="text-slate-800">
                        {formatCurrency(activeResident.securityDeposit)}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                      Stay Duration & KYC
                    </span>
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Move-in Date:</span>
                        <strong className="text-slate-800">{formatDate(activeResident.moveInDate)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Total Stay:</span>
                        <strong className="text-emerald-700 font-semibold">
                          {calculateStayDuration(activeResident.moveInDate)}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Aadhaar (Masked):</span>
                        <strong className="font-mono text-slate-700">
                          {activeResident.aadharNumberMasked}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Emergency Contact:</span>
                        <strong className="text-slate-800 truncate max-w-[150px]">
                          {activeResident.emergencyContact.name} ({activeResident.emergencyContact.phone})
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 mt-2 border-t border-slate-200/80">
                    <button
                      type="button"
                      onClick={() => setViewingAadhaarResident(activeResident)}
                      className="w-full py-1.5 px-3 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-2xs"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>View Uploaded Aadhaar Card (Front/Back)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Payment History Ledger */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-900 text-xs">Payment History & Ledger</h4>
                  <button
                    onClick={() => {
                      onOpenPaymentModalForResident(activeResident.id);
                    }}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-[11px] transition shadow-2xs"
                  >
                    + Record Payment
                  </button>
                </div>

                {payments.filter((p) => p.residentId === activeResident.id).length === 0 ? (
                  <p className="text-slate-400 text-xs py-4 text-center">No payment transactions recorded.</p>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {payments
                      .filter((p) => p.residentId === activeResident.id)
                      .map((p) => (
                        <div key={p.id} className="p-3 bg-white flex items-center justify-between text-xs">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800">
                                {formatCurrency(p.amountPaid)}
                              </span>
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  p.status === 'Paid'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-amber-50 text-amber-700'
                                }`}
                              >
                                {p.status}
                              </span>
                              <span className="text-slate-500 font-medium">({p.paymentType})</span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {p.billingMonth} • Paid via {p.paymentMethod} on {formatDate(p.paidAt)}
                            </p>
                          </div>

                          <div className="text-right font-mono text-[11px] text-slate-500">
                            {p.transactionReference && <span>Ref: {p.transactionReference}</span>}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Lifecycle Actions */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <div className="flex items-center gap-2">
                  {activeResident.status === 'ACTIVE' && (
                    <button
                      onClick={() =>
                        changeResidentStatus(
                          activeResident.id,
                          'NOTICE',
                          new Date().toISOString().split('T')[0]
                        )
                      }
                      className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold rounded-lg text-xs transition"
                    >
                      Put on 30-Day Notice
                    </button>
                  )}

                  {activeResident.status === 'VACATED' ? (
                    <button
                      onClick={() => handleOpenUnvacate(activeResident)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs transition flex items-center gap-1.5 shadow-xs"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Unvacate / Re-admit Tenant</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `Vacate resident ${activeResident.fullName}? This will mark status as Vacated and free Bed ${activeResident.bedNumber}.`
                          )
                        ) {
                          changeResidentStatus(
                            activeResident.id,
                            'VACATED',
                            undefined,
                            new Date().toISOString().split('T')[0]
                          );
                        }
                      }}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-lg text-xs transition"
                    >
                      Mark as Vacated (Free Bed)
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setSharingResident(activeResident)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs transition flex items-center gap-1"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share Details</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unvacate & Reactivate Resident Modal */}
      {unvacatingResident && (
        <div
          id="unvacate-resident-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative">
            <button
              onClick={() => setUnvacatingResident(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Unvacate & Re-admit Tenant</h3>
                <p className="text-xs text-slate-500">Reactivate {unvacatingResident.fullName} to Active status</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Tenant Name:</span>
                  <span className="font-semibold text-slate-800">{unvacatingResident.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tenant ID:</span>
                  <span className="font-mono text-slate-700">{unvacatingResident.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Monthly Rent:</span>
                  <span className="font-semibold text-emerald-700">{formatCurrency(unvacatingResident.monthlyRent)}</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Room to Allocate</label>
                <select
                  value={unvacateRoomId}
                  onChange={(e) => {
                    const rId = e.target.value;
                    setUnvacateRoomId(rId);
                    const selRoom = rooms.find((r) => r.id === rId);
                    const availBed = selRoom?.beds.find((b) => b.status === 'Available') || selRoom?.beds[0];
                    setUnvacateBedId(availBed?.id || '');
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  {rooms.map((room) => {
                    const availCount = room.beds.filter((b) => b.status === 'Available').length;
                    return (
                      <option key={room.id} value={room.id}>
                        Room {room.roomNumber} ({room.sharingType} - {availCount} available beds)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Bed</label>
                <select
                  value={unvacateBedId}
                  onChange={(e) => setUnvacateBedId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  {rooms
                    .find((r) => r.id === unvacateRoomId)
                    ?.beds.map((bed) => (
                      <option key={bed.id} value={bed.id}>
                        Bed {bed.bedNumber} ({bed.status})
                      </option>
                    ))}
                </select>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-[11px] flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>
                  Reactivating will change status to <strong>ACTIVE</strong>, mark the selected bed as <strong>Occupied</strong>, and include the tenant in current monthly billing.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUnvacatingResident(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmUnvacate}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs shadow-sm transition flex items-center gap-1.5"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Confirm & Unvacate</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo Zoom Modal */}
      {zoomedPhoto && (
        <div
          id="photo-zoom-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in"
          onClick={() => setZoomedPhoto(null)}
        >
          <div
            className="relative bg-white rounded-3xl p-4 max-w-md w-full shadow-2xl border border-slate-800 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setZoomedPhoto(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-sm font-bold text-slate-900 mb-3">{zoomedPhoto.name}</h3>
            <div className="w-full aspect-square max-h-[380px] rounded-2xl overflow-hidden bg-slate-100 flex items-center justify-center border border-slate-200">
              {zoomedPhoto.url ? (
                <img
                  src={zoomedPhoto.url}
                  alt={zoomedPhoto.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Avatar name={zoomedPhoto.name} size="xl" rounded="rounded-2xl" />
                  <p className="text-xs">No custom photo uploaded</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Aadhaar Document Viewer Modal */}
      <AadhaarDocumentViewerModal
        isOpen={Boolean(viewingAadhaarResident)}
        onClose={() => setViewingAadhaarResident(null)}
        documentData={viewingAadhaarResident}
        onUpdateAadhaarUrl={(newUrl) => {
          if (viewingAadhaarResident) {
            setViewingAadhaarResident({
              ...viewingAadhaarResident,
              aadharUrl: newUrl,
            });
          }
        }}
      />

      {/* Sensitive Edit Passcode Verification Modal */}
      <SensitiveEditModal
        isOpen={showSensitiveModal}
        onClose={() => setShowSensitiveModal(false)}
        onVerified={() => {
          setIsEditingResident(true);
        }}
      />

      {/* Share Modal */}
      <ShareDetailsModal
        isOpen={Boolean(sharingResident)}
        onClose={() => setSharingResident(null)}
        resident={sharingResident}
      />
    </div>
  );
};
