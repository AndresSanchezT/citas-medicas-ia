import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { cancelAppointment, checkIn, completeAppointment, markNoShow, startConsultation, type Appointment } from '../api/appointments';

// El "No-asistió" no tiene confirmación previa (se usa seguido, para varios pacientes
// seguidos), así que en vez de interrumpir con un confirm() se avisa el resultado de la
// política DESPUÉS, para que recepción sepa si debe avisarle al paciente sobre el plazo.
function avisarResultadoPolitica(appointment: Appointment) {
  if (!appointment.pagado) return;
  const monto = appointment.monto != null ? `S/ ${appointment.monto}` : 'el pago';
  if (appointment.reembolso === 'REEMBOLSADO' && appointment.plazoReprogramacionHasta) {
    const plazo = new Date(appointment.plazoReprogramacionHasta).toLocaleString('es-PE', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
    window.alert(`${monto} queda a salvo. El paciente tiene hasta el ${plazo} (24h) para reprogramar.`);
  } else if (appointment.reembolso === 'PERDIDO') {
    window.alert(`Se perdió ${monto}: ya había usado su única oportunidad de reprogramación.`);
  }
}

export function useAppointmentMutations(invalidateKey: QueryKey) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: invalidateKey });

  const checkInMutation = useMutation({ mutationFn: checkIn, onSuccess: invalidate });
  const startMutation = useMutation({ mutationFn: startConsultation, onSuccess: invalidate });
  const completeMutation = useMutation({ mutationFn: completeAppointment, onSuccess: invalidate });
  const cancelMutation = useMutation({ mutationFn: cancelAppointment, onSuccess: invalidate });
  const noShowMutation = useMutation({
    mutationFn: markNoShow,
    onSuccess: (appointment) => {
      invalidate();
      avisarResultadoPolitica(appointment);
    },
  });

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
