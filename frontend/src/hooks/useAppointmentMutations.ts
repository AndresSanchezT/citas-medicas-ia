import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { cancelAppointment, checkIn, completeAppointment, markNoShow, startConsultation } from '../api/appointments';

export function useAppointmentMutations(invalidateKey: QueryKey) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: invalidateKey });

  const checkInMutation = useMutation({ mutationFn: checkIn, onSuccess: invalidate });
  const startMutation = useMutation({ mutationFn: startConsultation, onSuccess: invalidate });
  const completeMutation = useMutation({ mutationFn: completeAppointment, onSuccess: invalidate });
  const cancelMutation = useMutation({ mutationFn: cancelAppointment, onSuccess: invalidate });
  const noShowMutation = useMutation({ mutationFn: markNoShow, onSuccess: invalidate });

  const busy =
    checkInMutation.isPending ||
    startMutation.isPending ||
    completeMutation.isPending ||
    cancelMutation.isPending ||
    noShowMutation.isPending;

  return {
    busy,
    onCheckIn: (id: number) => checkInMutation.mutate(id),
    onStart: (id: number) => startMutation.mutate(id),
    onComplete: (id: number) => completeMutation.mutate(id),
    onCancel: (id: number) => cancelMutation.mutate(id),
    onNoShow: (id: number) => noShowMutation.mutate(id),
  };
}
