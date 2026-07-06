-- FSM do chat: estado pendente persistido (sobrevive a restart/deploy)
ALTER TABLE "Conversation" ADD COLUMN "pendingState" JSONB;
